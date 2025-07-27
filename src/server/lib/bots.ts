import { and, eq } from "drizzle-orm";
import { env } from "~/env";
import { emitter } from "~/lib/events";
import { db } from "~/server/db";
import { beings, intentions } from "~/server/db/schema";
import type { Being, BeingId, Intention, IntentionId } from "~/server/db/types";
import { logger } from "~/server/lib/logger";
import { triggerSpaceUpdate } from "~/server/lib/simple-sync";
// Note: removed old state-sync dependency

const botLogger = logger.child({ name: "Bots" });

export async function activateBots(
	spaceId: BeingId,
	activatingIntentionId: IntentionId,
): Promise<void> {
	botLogger.info(
		{ spaceId, activatingIntentionId },
		"Activating bots in space",
	);

	// Find all bots in the space
	const botsInSpace = await db
		.select({ id: beings.id })
		.from(beings)
		.where(and(eq(beings.locationId, spaceId), eq(beings.type, "bot")));

	botLogger.info(
		{ spaceId, botCount: botsInSpace.length },
		"Found bots to activate",
	);

	// Activate each bot
	for (const bot of botsInSpace) {
		activateBot(bot.id as BeingId, spaceId, activatingIntentionId).catch(
			(error) =>
				botLogger.error(
					{ error, botId: bot.id, spaceId },
					"Bot activation failed",
				),
		);
	}
}

export async function activateBot(
	botId: BeingId,
	spaceId: BeingId,
	triggeringIntentionId: IntentionId,
): Promise<void> {
	try {
		botLogger.info({ botId, spaceId, triggeringIntentionId }, "Activating bot");

		// Create AI intention for this bot
		const aiIntentionId = `/utterance-ai-${crypto.randomUUID()}`;
		await db.insert(intentions).values({
			id: aiIntentionId,
			name: `AI Response from ${botId}`,
			type: "utterance",
			state: "active",
			ownerId: botId,
			locationId: spaceId,
			content: [""],
		});

		// Trigger space update to show the bot's initial "thinking" bubble
		triggerSpaceUpdate(spaceId).catch((error) =>
			botLogger.error({ error, spaceId }, "Failed to trigger space update for bot activation"),
		);

		// Stream the bot's response
		await streamBotResponse(
			botId,
			triggeringIntentionId,
			aiIntentionId,
			spaceId,
		);

		botLogger.info({ botId, aiIntentionId }, "Bot activation completed");
	} catch (error) {
		botLogger.error({ error, botId, spaceId }, "Bot activation failed");
	}
}

async function streamBotResponse(
	botId: BeingId,
	triggeringIntentionId: IntentionId,
	aiIntentionId: string,
	spaceId: BeingId,
): Promise<void> {
	try {
		// Load the bot being
		const bot = await db.query.beings.findFirst({
			where: eq(beings.id, botId),
		});

		if (!bot) {
			botLogger.error({ botId }, "Bot not found");
			return;
		}

		// Load the triggering intention
		const triggeringIntention = await db.query.intentions.findFirst({
			where: eq(intentions.id, triggeringIntentionId),
		});

		if (!triggeringIntention) {
			botLogger.error(
				{ triggeringIntentionId },
				"Triggering intention not found",
			);
			return;
		}

		botLogger.info(
			{ botId: bot.id, aiIntentionId },
			"Starting bot response stream",
		);

		// Use bot's model or default to a known working free model
		const model = bot.botModel ?? "meta-llama/llama-3.1-8b-instruct:free";

		// Build messages array with bot's system prompt if available
		const messages: Array<{ role: string; content: string }> = [];
		if (bot.botPrompt) {
			messages.push({ role: "system", content: bot.botPrompt });
		}
		const userContent = Array.isArray(triggeringIntention.content)
			? triggeringIntention.content[0]
			: triggeringIntention.content;
		messages.push({ role: "user", content: String(userContent ?? "") });

		// Determine the API key
		const apiKey = bot.llmApiKey ?? env.OPENROUTER_API_KEY;

		const requestBody = {
			model,
			messages,
			stream: true,
		};
		
		botLogger.info(
			{ aiIntentionId, model, requestBody },
			"Making OpenRouter API request",
		);

		const response = await fetch(
			"https://openrouter.ai/api/v1/chat/completions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
					"HTTP-Referer": "http://localhost:3000",
					"X-Title": "Rhiz.om",
				},
				body: JSON.stringify(requestBody),
			},
		);

		botLogger.info(
			{ aiIntentionId, status: response.status, statusText: response.statusText },
			"Got OpenRouter API response",
		);

		if (!response.ok) {
			const errorText = await response.text();
			botLogger.error(
				{ aiIntentionId, status: response.status, errorText },
				"OpenRouter API error response",
			);
			throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
		}

		if (!response.body) {
			throw new Error("Response body is null");
		}

		botLogger.info(
			{ aiIntentionId },
			"Got response body, starting stream processing",
		);

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let fullResponse = "";
		let lastUpdateTime = Date.now();
		let tokensReceived = 0;
		const UPDATE_INTERVAL = 500; // Update every 500ms during streaming

		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				botLogger.info(
					{ aiIntentionId, tokensReceived, responseLength: fullResponse.length },
					"Stream reading completed",
				);
				break;
			}

			const chunk = decoder.decode(value, { stream: true });
			botLogger.debug(
				{ aiIntentionId, chunkLength: chunk.length, chunk: chunk.substring(0, 200) },
				"Received chunk from stream",
			);
			
			// Handle different possible line endings and data formats
			const lines = chunk
				.split(/\r?\n/)
				.filter((line) => line.trim().startsWith("data: ") || line.trim() === "data: [DONE]");

			botLogger.debug(
				{ aiIntentionId, linesCount: lines.length },
				"Parsed lines from chunk",
			);

			for (const line of lines) {
				const jsonStr = line.replace("data: ", "").trim();
				if (jsonStr === "[DONE]") {
					botLogger.info({ aiIntentionId }, "Received [DONE] signal");
					break;
				}

				if (!jsonStr) continue;

				try {
					const parsed = JSON.parse(jsonStr);
					const token = parsed.choices?.[0]?.delta?.content;
					
					if (token) {
						tokensReceived++;
						fullResponse += token;
						emitter.emit(`update.${aiIntentionId}`, {
							type: "token",
							data: token,
						});
						
						// Update the database periodically during streaming to show partial content
						const now = Date.now();
						if (now - lastUpdateTime > UPDATE_INTERVAL) {
							botLogger.debug(
								{ aiIntentionId, currentLength: fullResponse.length, tokensReceived },
								"Updating database with partial response",
							);
							
							await db
								.update(intentions)
								.set({
									content: [fullResponse],
									modifiedAt: new Date(),
								})
								.where(eq(intentions.id, aiIntentionId));
							
							// Trigger space update to show partial response
							triggerSpaceUpdate(spaceId).catch((error) =>
								botLogger.debug({ error }, "Failed to trigger partial update"),
							);
							
							lastUpdateTime = now;
						}
					} else {
						botLogger.debug(
							{ aiIntentionId, parsed },
							"Received non-content delta",
						);
					}
				} catch (error) {
					botLogger.debug(
						{ aiIntentionId, jsonStr, error: error instanceof Error ? error.message : "unknown" },
						"Failed to parse JSON from stream line",
					);
				}
			}
		}

		botLogger.info(
			{ aiIntentionId, responseLength: fullResponse.length },
			"Bot streaming completed, updating database",
		);

		// Log warning for truly empty responses but use them as-is for debugging
		if (!fullResponse.trim()) {
			botLogger.warn(
				{ aiIntentionId, tokensReceived, originalResponse: fullResponse },
				"🚨 EMPTY RESPONSE: No content received from AI - check API and streaming",
			);
		}

		await db
			.update(intentions)
			.set({
				content: [fullResponse],
				state: "complete",
				modifiedAt: new Date(),
			})
			.where(eq(intentions.id, aiIntentionId));

		// Trigger space update to show the completed bot response
		triggerSpaceUpdate(spaceId).catch((error) =>
			botLogger.error({ error, spaceId }, "Failed to trigger space update after bot completion"),
		);

		emitter.emit(`update.${aiIntentionId}`, { type: "end" });
		botLogger.info({ aiIntentionId }, "Bot response stream fully completed");
	} catch (error) {
		botLogger.error(error, "Bot response generation failed");
		emitter.emit(`update.${aiIntentionId}`, {
			type: "error",
			data: "Failed to get response from AI.",
		});
		await db
			.update(intentions)
			.set({ state: "failed", content: ["AI failed to respond."] })
			.where(eq(intentions.id, aiIntentionId));

		// Trigger space update to show the error response
		triggerSpaceUpdate(spaceId).catch((updateError) =>
			botLogger.error({ error: updateError, spaceId }, "Failed to trigger space update after bot error"),
		);
	}
}
