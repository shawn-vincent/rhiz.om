import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import type { BeingId } from "~/server/db/types";
import {
	addSpaceConnection,
	fetchSpaceData,
	removeSpaceConnection,
} from "~/server/lib/simple-sync";

// This forces the route to be dynamic and not cached
export const dynamic = "force-dynamic";

const syncParamsSchema = z.object({
	spaceId: z.string(),
	types: z.string().default("beings,intentions"),
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

		const encoder = new TextEncoder();

		const stream = new ReadableStream({
			async start(controller) {
				try {
					// Add this connection to the space
					addSpaceConnection(spaceId as BeingId, controller);

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
				// Clean up connection when client disconnects
				removeSpaceConnection(spaceId as BeingId, this as any);
			},
		});

		// Clean up when the client closes the connection
		request.signal.addEventListener("abort", () => {
			removeSpaceConnection(spaceId as BeingId, stream as any);
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
