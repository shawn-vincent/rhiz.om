// src/server/api/routers/being.ts
import { z } from "zod/v4";
import { services } from "~/domain/services";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";
import { insertBeingSchema, selectBeingSchema } from "~/server/db/types";

export const beingRouter = createTRPCRouter({
	/**
	 * Fetches a single being by its public ID.
	 */
	getById: publicProcedure
		.input(z.object({ id: z.string() }))
		.output(selectBeingSchema)
		.query(async ({ input }) => {
			return services.being.getBeing(input.id);
		}),

	/**
	 * Creates or updates a being.
	 * This is a protected procedure, requiring the user to be authenticated.
	 * It also verifies that the user is the owner of the being they are trying to modify.
	 */
	upsert: protectedProcedure
		.input(insertBeingSchema)
		.mutation(async ({ ctx, input }) => {
			return services.being.upsertBeing(input, ctx.auth);
		}),

	/**
	 * Fetches all beings, ordered by name.
	 */
	getAll: publicProcedure.query(async () => {
		return services.being.getAllBeings();
	}),

	/**
	 * Fetches all beings in a specific location (space).
	 */
	getByLocation: publicProcedure
		.input(z.object({ locationId: z.string() }))
		.query(async ({ input }) => {
			return services.being.getBeingsByLocation(input.locationId);
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
		.query(async ({ input }) => {
			return services.being.searchBeings({
				q: input.q,
				kind: input.kind,
				sort: input.sort,
				limit: input.limit,
				cursor: input.cursor ?? undefined,
			});
		}),
});
