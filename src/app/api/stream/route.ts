/**
 * Ultra-minimal Server-Sent Events endpoint
 *
 * Single space-delta event with timestamp-based catch-up.
 * No being sync, no presence - maximum simplicity.
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
	// Required space ID - every sync connection is for a specific space
	spaceId: z.string().min(1),
	// Optional timestamp for catch-up
	since: z.string().nullish(),
});

export async function GET(request: NextRequest) {
	const url = request.nextUrl;
	const spaceIdParam = url.searchParams.get("spaceId");
	const sinceParam = url.searchParams.get("since");

	if (!spaceIdParam) {
		return new Response("spaceId parameter is required", { status: 400 });
	}

	const params = paramsSchema.parse({
		spaceId: spaceIdParam,
		since: sinceParam || undefined, // Convert null to undefined for Zod
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
			});

			logger.info(
				{
					connectionId,
					beingId,
					activeConnections: getActiveConnectionCount(),
				},
				"SSE connection established",
			);

			// Send initial data or catch-up delta
			sendInitialData(connectionId, params.since ?? undefined);
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
