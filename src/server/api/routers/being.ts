// src/server/api/routers/being.ts
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import type { BeingKind, EntitySummary } from "../../../../packages/entity-kit/src/types";

import { TRPCError } from "@trpc/server";
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

			// Use Drizzle's ON CONFLICT for an atomic upsert operation.
			// This is the best practice for create-or-update logic.
			return ctx.db
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
		}),

	/**
	 * Fetches all beings, ordered by name.
	 */
	getAll: publicProcedure.query(({ ctx }) => {
		return ctx.db.query.beings.findMany({
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
				cursor: z.string().uuid().nullish(),
			}),
		)
		.query(async ({ input }): Promise<{ items: EntitySummary[]; nextCursor: string | null }> => {
			// Mock implementation for now
			const allBeings: EntitySummary[] = [
				{ id: "1", name: "Alpha Space", kind: "space" },
				{ id: "2", name: "Beta Guest", kind: "guest" },
				{ id: "3", name: "Gamma Bot", kind: "bot" },
				{ id: "4", name: "Delta Document", kind: "document" },
				{ id: "5", name: "Echo Space", kind: "space" },
				{ id: "6", name: "Foxtrot Guest", kind: "guest" },
				{ id: "7", name: "Golf Bot", kind: "bot" },				
				{ id: "8", name: "Hotel Document", kind: "document" },
				{ id: "9", name: "India Space", kind: "space" },
				{ id: "10", name: "Juliett Guest", kind: "guest" },
			];

			let filteredBeings = allBeings.filter((b) => {
				const matchesQuery = input.q
					? b.name.toLowerCase().includes(input.q.toLowerCase())
					: true;
				const matchesKind = input.kind ? b.kind === input.kind : true;
				return matchesQuery && matchesKind;
			});

			if (input.sort === "name") {
				filteredBeings.sort((a, b) => a.name.localeCompare(b.name));
			} else if (input.sort === "createdAt") {
				// For mock, we'll just reverse to simulate creation order
				filteredBeings.reverse();
			}

			const limit = input.limit;
			const cursorIndex = input.cursor
				? filteredBeings.findIndex((b) => b.id === input.cursor)
				: -1;
			const startIndex = cursorIndex === -1 ? 0 : cursorIndex + 1;

			const items = filteredBeings.slice(startIndex, startIndex + limit);
			const nextCursor =
				startIndex + limit < filteredBeings.length
					? filteredBeings[startIndex + limit]?.id || null
					: null;

			return { items, nextCursor };
		}),
});
