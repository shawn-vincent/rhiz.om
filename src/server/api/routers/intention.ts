import { z } from "zod/v4";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";
import { services } from "~/domain/services";

export const intentionRouter = createTRPCRouter({
	getAllUtterancesInBeing: publicProcedure
		.input(z.object({ beingId: z.string() }))
		.query(async ({ input }) => {
			return services.intention.getIntentionsInLocation(input.beingId);
		}),

	createUtterance: protectedProcedure
		.input(z.object({ content: z.string().min(1), beingId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return services.intention.createUtterance(input, ctx.session);
		}),
});
