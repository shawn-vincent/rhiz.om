import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, ilike } from "drizzle-orm";
import { emitter } from "~/lib/events";
import { canEdit } from "~/lib/permissions";
import type { DrizzleDB } from "~/server/db";
import { beings } from "~/server/db/schema";
import { insertBeingSchema, selectBeingSchema } from "~/server/db/types";
import type { Being, BeingId, InsertBeing } from "~/server/db/types";
// No more being sync notifications - beings use tRPC cache invalidation
import type {
	BeingType,
	EntitySummary,
} from "../../packages/entity-kit/src/types";
import type { AuthContext } from "./auth-service";

export interface CreateBeingInput
	extends Omit<InsertBeing, "modifiedAt" | "createdAt"> {}

export interface UpdateBeingInput extends Partial<CreateBeingInput> {
	id: string;
}

export interface SearchBeingsInput {
	q?: string;
	kind?: BeingType;
	sort?: "name" | "createdAt";
	limit?: number;
	cursor?: string;
}

export interface SearchBeingsResult {
	items: EntitySummary[];
	nextCursor: string | null;
}

export class BeingService {
	constructor(private db: DrizzleDB) {}

	/**
	 * Get a being by ID
	 */
	async getBeing(id: string): Promise<Being> {
		const being = await this.db.query.beings.findFirst({
			where: eq(beings.id, id),
		});

		if (!being) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: `Being with ID "${id}" not found.`,
			});
		}

		return selectBeingSchema.parse(being);
	}

	/**
	 * Get all beings, ordered by name
	 */
	async getAllBeings(): Promise<Being[]> {
		const allBeings = await this.db.query.beings.findMany({
			orderBy: (beings, { asc }) => [asc(beings.name)],
		});
		return allBeings.map((being) => selectBeingSchema.parse(being));
	}

	/**
	 * Get beings in a specific location
	 */
	async getBeingsByLocation(locationId: string): Promise<Being[]> {
		const results = await this.db.query.beings.findMany({
			where: eq(beings.locationId, locationId),
			orderBy: (beings, { asc }) => [asc(beings.name)],
		});
		return results.map((being) => selectBeingSchema.parse(being));
	}

	/**
	 * Search beings with filtering and pagination
	 */
	async searchBeings(input: SearchBeingsInput): Promise<SearchBeingsResult> {
		const limit = input.limit ?? 50;
		const orderBy =
			input.sort === "name" ? asc(beings.name) : desc(beings.createdAt);

		const whereClause = and(
			input.q ? ilike(beings.name, `%${input.q}%`) : undefined,
			input.kind ? eq(beings.type, input.kind) : undefined,
			input.cursor
				? input.sort === "name"
					? gt(beings.name, input.cursor)
					: gt(
							beings.createdAt,
							(
								await this.db.query.beings.findFirst({
									where: eq(beings.id, input.cursor),
								})
							)?.createdAt || new Date(0),
						)
				: undefined,
		);

		const fetchedBeings = await this.db.query.beings.findMany({
			where: whereClause,
			orderBy: [orderBy],
			limit: limit + 1,
		});

		let nextCursor: string | null = null;
		if (fetchedBeings.length > limit) {
			const nextItem = fetchedBeings.pop();
			if (nextItem) {
				nextCursor = nextItem.id;
			}
		}

		const items: EntitySummary[] = fetchedBeings.map((b) => ({
			id: b.id,
			name: b.name,
			type: b.type as BeingType,
		}));

		return { items, nextCursor };
	}

	/**
	 * Create or update a being with proper authorization and side effects
	 */
	async upsertBeing(input: InsertBeing, auth: AuthContext): Promise<Being> {
		const { sessionBeingId, isCurrentUserSuperuser } = auth;

		// Authorization: Check if user can edit this being (owner or superuser)
		if (!canEdit(sessionBeingId, input.ownerId, isCurrentUserSuperuser)) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: `You can only save beings that you own or have superuser access to [Tried to modify ${input.id} owned by ${input.ownerId || "UNDEFINED"}, you=${sessionBeingId || "UNDEFINED"}, superuser=${isCurrentUserSuperuser}.]`,
			});
		}

		// Check if locationId changed to broadcast presence update
		const existingBeing = await this.db.query.beings.findFirst({
			where: eq(beings.id, input.id),
		});

		// Use Drizzle's ON CONFLICT for an atomic upsert operation
		await this.db
			.insert(beings)
			.values({
				...input,
				modifiedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: beings.id,
				set: {
					...input,
					modifiedAt: new Date(),
				},
			});

		// Fetch the upserted being to return proper data
		const result = await this.db.query.beings.findFirst({
			where: eq(beings.id, input.id),
		});

		if (!result) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to create or update being",
			});
		}

		// Notify sync system for real-time updates
		if (!existingBeing) {
			// New being created - notify the space they're joining
			if (input.locationId) {
				const { notifyBeingCreated } = await import("~/server/lib/stream");
				notifyBeingCreated(input.id, input.locationId);
			}
		} else {
			// Being updated - notify both old and new spaces if location changed
			const oldSpaceId = existingBeing.locationId;
			const newSpaceId = input.locationId;
			
			const { notifyBeingUpdated } = await import("~/server/lib/stream");
			
			if (oldSpaceId && oldSpaceId !== newSpaceId) {
				// Notify old space that being left
				notifyBeingUpdated(input.id, oldSpaceId);
			}
			
			if (newSpaceId) {
				// Notify new space that being joined/updated
				notifyBeingUpdated(input.id, newSpaceId);
			}
		}

		// Emit bot location change event for server-side agents
		if (input.type === "bot") {
			emitter.emit("bot-location-change", {
				beingId: input.id,
				spaceId: input.locationId,
				oldSpaceId: existingBeing?.locationId || null,
			});
		}

		return selectBeingSchema.parse(result);
	}
}
