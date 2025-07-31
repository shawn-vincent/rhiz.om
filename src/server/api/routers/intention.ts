import { z } from "zod/v4";
import { services } from "~/domain/services";
import { beingIdSchema } from "~/lib/types";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";

export const intentionRouter = createTRPCRouter({
	getAllUtterancesInBeing: publicProcedure
		.input(z.object({ beingId: beingIdSchema }))
		.query(async ({ input }) => {
			return services.intention.getIntentionsInLocation(input.beingId);
		}),

	createUtterance: protectedProcedure
		.input(z.object({ content: z.string().min(1), beingId: beingIdSchema }))
		.mutation(async ({ ctx, input }) => {
			return services.intention.createUtterance(input, ctx.auth);
		}),
});
