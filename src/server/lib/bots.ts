import { and, eq } from "drizzle-orm";
import { env } from "~/env";
import { emitter } from "~/lib/events";
import { db } from "~/server/db";
import { beings, intentions } from "~/server/db/schema";
import type { Being, BeingId, Intention, IntentionId } from "~/server/db/types";
import { broadcastSyncEvent } from "~/server/lib/livekit";
import { logger } from "~/server/lib/logger";

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

		// Notify that the bot intention was created
		broadcastSyncEvent(spaceId, {
			type: "intention-created",
			data: { id: aiIntentionId },
			timestamp: new Date().toISOString(),
		});

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

		// Check if API key is empty or missing
		if (!apiKey || apiKey.trim() === "") {
			const errorMessage =
				"LLM API key is missing or empty. Please configure OPENROUTER_API_KEY in your environment or provide an API key for the bot.";
			botLogger.error({ botId }, errorMessage);

			// Update the intention with the error
			await db
				.update(intentions)
				.set({
					state: "failed",
					content: [errorMessage],
					modifiedAt: new Date(),
				})
				.where(eq(intentions.id, aiIntentionId));

			// Error will be visible via intention update

			// Trigger space update to show the error
			broadcastSyncEvent(spaceId, {
				type: "intention-updated",
				data: { id: aiIntentionId },
				timestamp: new Date().toISOString(),
			});

			return;
		}

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
				body: JSON.stringify(requestBody), // External API - must use standard JSON
			},
		);

		botLogger.info(
			{
				aiIntentionId,
				status: response.status,
				statusText: response.statusText,
			},
			"Got OpenRouter API response",
		);

		if (!response.ok) {
			const errorText = await response.text();
			// Parse error for logging to help with debugging
			let parsedError;
			try {
				parsedError = JSON.parse(errorText);
			} catch {
				parsedError = { raw: errorText };
			}

			botLogger.error(
				{
					aiIntentionId,
					status: response.status,
					errorText,
					parsedError,
				},
				"OpenRouter API error response",
			);

			// Try to parse error as JSON for more structured error info
			let errorDetails = errorText;
			try {
				const errorJson = JSON.parse(errorText);

				// Extract nested error details with provider information
				if (errorJson.error) {
					const error = errorJson.error;
					const parts: string[] = [];

					// Main error message
					if (error.message) {
						parts.push(error.message);
					}

					// Add provider-specific details if available
					if (error.metadata) {
						if (error.metadata.provider_name) {
							parts.push(`Provider: ${error.metadata.provider_name}`);
						}

						// If there's a raw HTML error, try to extract the meaningful part
						if (error.metadata.raw && typeof error.metadata.raw === "string") {
							const htmlMatch = error.metadata.raw.match(
								/<title>(.*?)<\/title>/,
							);
							if (htmlMatch) {
								parts.push(`Raw error: ${htmlMatch[1]}`);
							} else if (error.metadata.raw.length < 200) {
								// Only include short raw errors to avoid HTML spam
								parts.push(`Raw: ${error.metadata.raw.trim()}`);
							}
						}
					}

					// Add error code if different from HTTP status
					if (error.code && error.code !== response.status) {
						parts.push(`Code: ${error.code}`);
					}

					errorDetails = parts.length > 0 ? parts.join(" | ") : errorText;
				} else if (errorJson.message) {
					errorDetails = errorJson.message;
				}
			} catch {
				// If parsing fails, use the raw text
			}

			throw new Error(
				`OpenRouter API error (${response.status}): ${errorDetails}`,
			);
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
					{
						aiIntentionId,
						tokensReceived,
						responseLength: fullResponse.length,
					},
					"Stream reading completed",
				);
				break;
			}

			const chunk = decoder.decode(value, { stream: true });
			botLogger.debug(
				{
					aiIntentionId,
					chunkLength: chunk.length,
					chunk: chunk.substring(0, 200),
				},
				"Received chunk from stream",
			);

			// Handle different possible line endings and data formats
			const lines = chunk
				.split(/\r?\n/)
				.filter(
					(line) =>
						line.trim().startsWith("data: ") || line.trim() === "data: [DONE]",
				);

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
					const parsed = JSON.parse(jsonStr); // External API response - standard JSON
					const token = parsed.choices?.[0]?.delta?.content;

					if (token) {
						tokensReceived++;
						fullResponse += token;
						// Token updates handled via intention updates

						// Update the database periodically during streaming to show partial content
						const now = Date.now();
						if (now - lastUpdateTime > UPDATE_INTERVAL) {
							botLogger.debug(
								{
									aiIntentionId,
									currentLength: fullResponse.length,
									tokensReceived,
								},
								"Updating database with partial response",
							);

							await db
								.update(intentions)
								.set({
									content: [fullResponse],
									modifiedAt: new Date(),
								})
								.where(eq(intentions.id, aiIntentionId));

							// Trigger intention update to show partial response
							broadcastSyncEvent(spaceId, {
								type: "intention-updated",
								data: { id: aiIntentionId },
								timestamp: new Date().toISOString(),
							});

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
						{
							aiIntentionId,
							jsonStr,
							error: error instanceof Error ? error.message : "unknown",
						},
						"Failed to parse JSON from stream line",
					);
				}
			}
		}

		botLogger.info(
			{ aiIntentionId, responseLength: fullResponse.length },
			"Bot streaming completed, updating database",
		);

		await db
			.update(intentions)
			.set({
				content: [fullResponse],
				state: "complete",
				modifiedAt: new Date(),
			})
			.where(eq(intentions.id, aiIntentionId));

		// Trigger intention update to show the completed bot response
		broadcastSyncEvent(spaceId, {
			type: "intention-updated",
			data: { id: aiIntentionId },
			timestamp: new Date().toISOString(),
		});

		// Completion handled via intention update
		botLogger.info({ aiIntentionId }, "Bot response stream fully completed");
	} catch (error) {
		botLogger.error(error, "Bot response generation failed");

		// Extract detailed error message
		let errorMessage = "Failed to get response from AI";

		if (error instanceof Error) {
			errorMessage = error.message;

			// If this is an HTTP error with a response body, include it
			if (error.message.includes("OpenRouter API error:")) {
				errorMessage = error.message;
			}
		} else if (typeof error === "string") {
			errorMessage = error;
		} else if (error && typeof error === "object" && "message" in error) {
			errorMessage = String(error.message);
		}

		// Error will be visible via intention update

		// Store the detailed error in the database
		await db
			.update(intentions)
			.set({ state: "failed", content: [errorMessage] })
			.where(eq(intentions.id, aiIntentionId));

		// Trigger intention update to show the error response
		broadcastSyncEvent(spaceId, {
			type: "intention-updated",
			data: { id: aiIntentionId },
			timestamp: new Date().toISOString(),
		});
	}
}
