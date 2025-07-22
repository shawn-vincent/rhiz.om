import { Readable } from "node:stream";
import { observable } from "@trpc/server/observable";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import { TRPCError } from "@trpc/server";
import { env } from "~/env";
import { emitter } from "~/lib/events";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "~/server/api/trpc";
import type { DrizzleDB } from "~/server/db";
import { intentions, users } from "~/server/db/schema";
import type { BeingId } from "~/server/db/types";
import { logger } from "~/server/lib/logger";
import { triggerIntentionsUpdate } from "~/server/lib/state-sync";

const intentionLogger = logger.child({ name: "IntentionRouter" });

const AI_AGENT_BEING_ID = "@rhiz.om-assistant";

// The core AI streaming logic remains the same.
async function streamAiResponse({
	db,
	userContent,
	beingId,
	aiIntentionId,
}: {
	db: DrizzleDB;
	userContent: string;
	beingId: string;
	aiIntentionId: string;
}) {
	try {
		intentionLogger.info({ aiIntentionId, beingId }, "Starting AI response stream");
		const response = await fetch(
			"https://openrouter.ai/api/v1/chat/completions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
					"Content-Type": "application/json",
					"HTTP-Referer": "http://localhost:3000",
					"X-Title": "Rhiz.om",
				},
				body: JSON.stringify({
					model: "openai/gpt-3.5-turbo",
					messages: [{ role: "user", content: userContent }],
					stream: true,
				}),
			},
		);

		if (!response.body) {
			throw new Error("Response body is null");
		}

		intentionLogger.info({ aiIntentionId }, "Got response body, starting stream processing");

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let fullResponse = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			const lines = chunk
				.split("\n\n")
				.filter((line) => line.startsWith("data: "));

			for (const line of lines) {
				const jsonStr = line.replace("data: ", "");
				if (jsonStr === "[DONE]") break;

				try {
					const parsed = JSON.parse(jsonStr);
					const token = parsed.choices[0]?.delta?.content;
					if (token) {
						fullResponse += token;
						emitter.emit(`update.${aiIntentionId}`, {
							type: "token",
							data: token,
						});
					}
				} catch (error) {
					// Ignore parsing errors for non-json parts of the stream
				}
			}
		}

		intentionLogger.info({ aiIntentionId, responseLength: fullResponse.length }, "AI streaming completed, updating database");

		await db
			.update(intentions)
			.set({
				content: [fullResponse],
				state: "complete",
				modifiedAt: new Date(),
			})
			.where(eq(intentions.id, aiIntentionId));

		// Trigger state sync update for the space
		await triggerIntentionsUpdate(beingId as BeingId, {
			type: "update",
			entityId: aiIntentionId,
			causedBy: AI_AGENT_BEING_ID as BeingId,
		});

		emitter.emit(`update.${aiIntentionId}`, { type: "end" });
		intentionLogger.info({ aiIntentionId }, "AI response stream fully completed");
	} catch (error) {
		intentionLogger.error(error, "AI response generation failed");
		emitter.emit(`update.${aiIntentionId}`, {
			type: "error",
			data: "Failed to get response from AI.",
		});
		await db
			.update(intentions)
			.set({ state: "failed", content: ["AI failed to respond."] })
			.where(eq(intentions.id, aiIntentionId));

		// Trigger state sync update for failed AI response
		await triggerIntentionsUpdate(beingId as BeingId, {
			type: "update",
			entityId: aiIntentionId,
			causedBy: AI_AGENT_BEING_ID as BeingId,
		});
	}
}

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
			// This procedure remains the same
			const userRecord = await ctx.db.query.users.findFirst({
				where: eq(users.id, ctx.session.user.id),
			});
			if (!userRecord?.beingId)
				throw new Error("User does not have an associated Being.");

			const userIntentionId = `/utterance-${crypto.randomUUID()}`;
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
			await triggerIntentionsUpdate(input.beingId as BeingId, {
				type: "add",
				entityId: userIntentionId,
				causedBy: userRecord.beingId as BeingId,
			});

			const aiIntentionId = `/utterance-ai-${crypto.randomUUID()}`;
			await ctx.db.insert(intentions).values({
				id: aiIntentionId,
				name: "AI Response",
				type: "utterance",
				state: "active",
				ownerId: AI_AGENT_BEING_ID,
				locationId: input.beingId,
				content: [""],
			});

			// Trigger state sync update for AI message (initial state)
			await triggerIntentionsUpdate(input.beingId as BeingId, {
				type: "add",
				entityId: aiIntentionId,
				causedBy: AI_AGENT_BEING_ID as BeingId,
			});

			// We don't await this, it runs in the background
			streamAiResponse({
				db: ctx.db,
				userContent: input.content,
				beingId: input.beingId,
				aiIntentionId,
			}).catch((error) =>
				intentionLogger.error({ error }, "Stream AI response failed"),
			);

			return { success: true, aiIntentionId };
		}),
});
