import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, ilike } from "drizzle-orm";
import type { DrizzleDB } from "~/server/db";
import { beings } from "~/server/db/schema";
import { selectBeingSchema } from "~/server/db/types";
import type { Being, BeingId, InsertBeing } from "~/server/db/types";
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
		const { updateBeing } = await import("~/lib/being-operations");
		return await updateBeing(this.db, input, auth);
	}
}
