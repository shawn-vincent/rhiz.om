/**
 * Unified Server-Sent Events endpoint
 *
 * ONE endpoint for ALL real-time updates:
 * - Space data changes (beings, intentions)
 * - Chat message tokens
 * - Presence updates
 *
 * Simple, reliable, debuggable.
 */
import type { NextRequest } from "next/server";
import superjson from "superjson";
import { z } from "zod/v4";
import { auth } from "~/server/auth";
import { logger } from "~/server/lib/logger";
import {
	addConnection,
	getActiveConnectionCount,
	removeConnection,
	sendInitialData,
} from "~/server/lib/stream";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
	// Optional filters - if not provided, gets all updates
	spaceId: z.string().optional(),
	types: z.string().optional(), // "beings,intentions,chat,presence"
});

export async function GET(request: NextRequest) {
	const url = request.nextUrl;
	const params = paramsSchema.parse({
		spaceId: url.searchParams.get("spaceId") || undefined,
		types: url.searchParams.get("types") || undefined,
	});

	const session = await auth();
	const beingId = session?.user?.beingId;
	const connectionId = crypto.randomUUID();

	logger.info(
		{
			connectionId,
			beingId,
			params,
			userAgent: request.headers.get("user-agent"),
			ip: request.headers.get("x-forwarded-for"),
		},
		"SSE connection starting",
	);

	const stream = new ReadableStream({
		start(controller) {
			// Register this connection
			addConnection(connectionId, {
				controller,
				beingId,
				spaceId: params.spaceId,
				types: params.types?.split(",") || [],
			});

			logger.info(
				{
					connectionId,
					beingId,
					activeConnections: getActiveConnectionCount(),
				},
				"SSE connection established",
			);

			// Send initial data immediately
			sendInitialData(connectionId);
		},

		cancel() {
			removeConnection(connectionId);
			logger.info(
				{
					connectionId,
					beingId,
					activeConnections: getActiveConnectionCount(),
				},
				"SSE connection closed",
			);
		},
	});

	// Handle client disconnect
	request.signal.addEventListener("abort", () => {
		removeConnection(connectionId);
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET",
			"Access-Control-Allow-Headers": "Cache-Control",
		},
	});
}
