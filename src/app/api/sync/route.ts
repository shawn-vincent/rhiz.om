import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { auth } from "~/server/auth";
import type { BeingId } from "~/server/db/types";
import { beingConnections, connections } from "~/server/lib/presence";
import {
	addSpaceConnection,
	fetchSpaceData,
	removeSpaceConnection,
} from "~/server/lib/simple-sync";

// This forces the route to be dynamic and not cached
export const dynamic = "force-dynamic";

const syncParamsSchema = z.object({
	spaceId: z.string(),
	types: z.string().nullish().default("beings,intentions"),
});

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const { spaceId, types } = syncParamsSchema.parse({
			spaceId: searchParams.get("spaceId"),
			types: searchParams.get("types"),
		});

		// Validate types parameter
		const validTypes = ["beings", "intentions", "beings,intentions"];
		if (!validTypes.includes(types)) {
			return new Response("Invalid types parameter", { status: 400 });
		}

		// Get the current session to identify the being
		const session = await auth();
		const beingId = session?.user?.beingId;

		const encoder = new TextEncoder();
		const connectionId = Math.random().toString(36).substring(7);
		let streamController: ReadableStreamDefaultController | null = null;

		const stream = new ReadableStream({
			async start(controller) {
				streamController = controller;
				try {
					// Add this connection to the space
					addSpaceConnection(spaceId as BeingId, controller);

					// Register being connection for presence if authenticated
					if (beingId) {
						connections.set(connectionId, {
							controller,
							beingId,
							connectedAt: Date.now(),
							lastHeartbeat: Date.now(),
						});

						// Add to being connections map
						if (!beingConnections.has(beingId)) {
							beingConnections.set(beingId, new Set());
						}
						beingConnections.get(beingId)?.add(connectionId);
					}

					// Send initial space data
					const initialData = await fetchSpaceData(spaceId as BeingId);
					const message = `data: ${JSON.stringify(initialData)}\n\n`;
					controller.enqueue(encoder.encode(message));
				} catch (error) {
					console.error("Error initializing sync stream:", error);
					const errorMessage = `data: ${JSON.stringify({
						error: "Failed to initialize stream",
					})}\n\n`;
					controller.enqueue(encoder.encode(errorMessage));
					controller.close();
				}
			},
			cancel() {
				// Clean up space connection
				if (streamController) {
					removeSpaceConnection(spaceId as BeingId, streamController);
				}

				// Clean up being connection
				if (beingId) {
					connections.delete(connectionId);
					const beingConnectionSet = beingConnections.get(beingId);
					if (beingConnectionSet) {
						beingConnectionSet.delete(connectionId);
						if (beingConnectionSet.size === 0) {
							beingConnections.delete(beingId);
						}
					}
				}
			},
		});

		// Clean up when the client closes the connection
		request.signal.addEventListener("abort", () => {
			// Space connection cleanup is handled in the stream's cancel method

			// Clean up being connection
			if (beingId) {
				connections.delete(connectionId);
				const beingConnectionSet = beingConnections.get(beingId);
				if (beingConnectionSet) {
					beingConnectionSet.delete(connectionId);
					if (beingConnectionSet.size === 0) {
						beingConnections.delete(beingId);
					}
				}
			}
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
				"X-Accel-Buffering": "no", // Disable Nginx buffering
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type",
			},
		});
	} catch (error) {
		console.error("Sync API error:", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Internal server error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}

// Handle preflight requests
export async function OPTIONS() {
	return new Response(null, {
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
}
