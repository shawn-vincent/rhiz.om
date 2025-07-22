// src/server/api/routers/being.ts
import { and, asc, desc, eq, gt, ilike } from "drizzle-orm";
import { z } from "zod/v4";
import type {
	BeingType,
	EntitySummary,
} from "../../../../packages/entity-kit/src/types";

import { TRPCError } from "@trpc/server";
import { broadcastPresenceUpdate } from "~/app/api/presence/events/route";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";
import { beings } from "~/server/db/schema";
import { insertBeingSchema, selectBeingSchema } from "~/server/db/types";

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

			// Authorization: Ensure user is trying to save a being they own.
			if (!input.ownerId || input.ownerId !== sessionBeingId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: `You can only save beings that you own [Tried to modify ${input.id} owned by ${input.ownerId || "UNDEFINED"}, you=${sessionBeingId || "UNDEFINED"}.]`,
				});
			}

			// Check if locationId changed to broadcast presence update
			const existingBeing = await ctx.db.query.beings.findFirst({
				where: eq(beings.id, input.id),
			});

			// Use Drizzle's ON CONFLICT for an atomic upsert operation.
			// This is the best practice for create-or-update logic.
			const result = await ctx.db
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

			// Broadcast presence update if location changed
			if (existingBeing?.locationId !== input.locationId) {
				broadcastPresenceUpdate({
					type: "location_change",
					beingId: input.id,
					locationId: input.locationId,
				});
			}

			return result;
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
