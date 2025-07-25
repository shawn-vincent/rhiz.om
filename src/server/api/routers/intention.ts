import { observable } from "@trpc/server/observable";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import { TRPCError } from "@trpc/server";
import { emitter } from "~/lib/events";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";
import { intentions, users } from "~/server/db/schema";
import type { BeingId, IntentionId } from "~/server/db/types";
import { activateBots } from "~/server/lib/bots";
import { logger } from "~/server/lib/logger";
// Note: removed old state-sync dependency

const intentionLogger = logger.child({ name: "IntentionRouter" });

export const intentionRouter = createTRPCRouter({
	getAllUtterancesInBeing: publicProcedure
		.input(z.object({ beingId: z.string() }))
		.query(async ({ ctx, input }) => {
			// This procedure remains the same
			return ctx.db.query.intentions.findMany({
				where: eq(intentions.locationId, input.beingId),
				orderBy: (intentions, { asc }) => [asc(intentions.createdAt)],
			});
		}),

	createUtterance: protectedProcedure
		.input(z.object({ content: z.string().min(1), beingId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userRecord = await ctx.db.query.users.findFirst({
				where: eq(users.id, ctx.session.user.id),
			});
			if (!userRecord?.beingId)
				throw new Error("User does not have an associated Being.");

			const userIntentionId: IntentionId = `/${crypto.randomUUID()}`;
			await ctx.db.insert(intentions).values({
				id: userIntentionId,
				name: `Utterance by ${ctx.session.user.name ?? "user"}`,
				type: "utterance",
				state: "complete",
				ownerId: userRecord.beingId,
				locationId: input.beingId,
				content: [input.content],
			});

			// Trigger state sync update for user message
			// Note: removed old state sync system call - new simple sync handles this automatically

			// Activate all bots in the space
			activateBots(input.beingId as BeingId, userIntentionId).catch((error) =>
				intentionLogger.error({ error }, "Bot activation failed"),
			);

			return { success: true };
		}),
});
