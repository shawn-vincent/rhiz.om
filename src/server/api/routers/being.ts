// src/server/api/routers/being.ts
import { and, asc, desc, eq, gt, ilike } from "drizzle-orm";
import { z } from "zod/v4";
import type {
	BeingType,
	EntitySummary,
} from "../../../../packages/entity-kit/src/types";

import { TRPCError } from "@trpc/server";
import { emitter } from "~/lib/events";
import { canEdit, isSuperuser } from "~/lib/permissions";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";
import { beings } from "~/server/db/schema";
import { insertBeingSchema, selectBeingSchema } from "~/server/db/types";
import type { BeingId } from "~/server/db/types";
import { broadcastPresenceUpdate } from "~/server/lib/presence";
import { triggerPresenceUpdate } from "~/server/lib/state-sync";

export const beingRouter = createTRPCRouter({
	/**
	 * Fetches a single being by its public ID.
	 */
	getById: publicProcedure
		.input(z.object({ id: z.string() }))
		.output(selectBeingSchema)
		.query(async ({ ctx, input }) => {
			const being = await ctx.db.query.beings.findFirst({
				where: eq(beings.id, input.id),
			});
			if (!being) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Being with ID "${input.id}" not found.`,
				});
			}
			return selectBeingSchema.parse(being);
		}),

	/**
	 * Creates or updates a being.
	 * This is a protected procedure, requiring the user to be authenticated.
	 * It also verifies that the user is the owner of the being they are trying to modify.
	 */
	upsert: protectedProcedure
		.input(insertBeingSchema)
		.mutation(async ({ ctx, input }) => {
			const sessionBeingId = ctx.session.user.beingId;

			// Get current user's being to check superuser status
			const currentUserRaw = sessionBeingId ? await ctx.db.query.beings.findFirst({
				where: eq(beings.id, sessionBeingId),
			}) : null;
			
			// Parse the being data to match the expected type
			const currentUser = currentUserRaw ? selectBeingSchema.parse(currentUserRaw) : null;
			const isCurrentUserSuperuser = isSuperuser(currentUser);

			// Authorization: Check if user can edit this being (owner or superuser)
			if (!canEdit(sessionBeingId, input.ownerId, isCurrentUserSuperuser)) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: `You can only save beings that you own or have superuser access to [Tried to modify ${input.id} owned by ${input.ownerId || "UNDEFINED"}, you=${sessionBeingId || "UNDEFINED"}, superuser=${isCurrentUserSuperuser}.]`,
				});
			}

			// Check if locationId changed to broadcast presence update
			const existingBeing = await ctx.db.query.beings.findFirst({
				where: eq(beings.id, input.id),
			});

			// Use Drizzle's ON CONFLICT for an atomic upsert operation.
			// This is the best practice for create-or-update logic.
			await ctx.db
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
			const result = await ctx.db.query.beings.findFirst({
				where: eq(beings.id, input.id),
			});

			console.log("🐛 being.upsert - result from DB:", result);
			console.log("🐛 being.upsert - result.id:", result?.id);

			if (!result) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create or update being",
				});
			}

			// Broadcast presence update if location changed
			if (existingBeing?.locationId !== input.locationId) {
				// Legacy presence system
				broadcastPresenceUpdate({
					type: "location_change",
					beingId: input.id,
					locationId: input.locationId,
				});

				// New state sync system - trigger updates for both old and new spaces
				if (existingBeing?.locationId) {
					triggerPresenceUpdate(existingBeing.locationId as BeingId, {
						type: "remove",
						entityId: input.id,
						causedBy: input.id as BeingId,
					});
				}

				if (input.locationId) {
					triggerPresenceUpdate(input.locationId as BeingId, {
						type: "add",
						entityId: input.id,
						causedBy: input.id as BeingId,
					});
				}

				// Emit bot location change event for server-side agents
				if (input.type === "bot") {
					emitter.emit("bot-location-change", {
						beingId: input.id,
						spaceId: input.locationId,
						oldSpaceId: existingBeing?.locationId || null,
					});
				}
			}

			// Parse the result through the schema to ensure proper typing
			const parsedResult = selectBeingSchema.parse(result);
			console.log("🐛 being.upsert - parsedResult:", parsedResult);
			console.log("🐛 being.upsert - parsedResult.id:", parsedResult.id);
			
			return parsedResult;
		}),

	/**
	 * Fetches all beings, ordered by name.
	 */
	getAll: publicProcedure.query(({ ctx }) => {
		return ctx.db.query.beings.findMany({
			orderBy: (beings, { asc }) => [asc(beings.name)],
			columns: {
				id: true,
				name: true,
				type: true,
			},
		});
	}),

	/**
	 * Fetches all beings in a specific location (space).
	 */
	getByLocation: publicProcedure
		.input(z.object({ locationId: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.query.beings.findMany({
				where: eq(beings.locationId, input.locationId),
				orderBy: (beings, { asc }) => [asc(beings.name)],
			});
		}),

	/**
	 * Searches for beings based on query, kind, and sort order.
	 */
	search: publicProcedure
		.input(
			z.object({
				q: z.string().max(120).default(""),
				kind: z.enum(["space", "guest", "bot", "document"]).optional(),
				sort: z.enum(["name", "createdAt"]).default("name"),
				limit: z.number().int().min(1).max(100).default(50),
				cursor: z.string().nullish(),
			}),
		)
		.query(
			async ({
				ctx,
				input,
			}): Promise<{ items: EntitySummary[]; nextCursor: string | null }> => {
				const limit = input.limit;
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
										await ctx.db.query.beings.findFirst({
											where: eq(beings.id, input.cursor),
										})
									)?.createdAt || new Date(0),
								)
						: undefined,
				);

				const fetchedBeings = await ctx.db.query.beings.findMany({
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
			},
		),
});
