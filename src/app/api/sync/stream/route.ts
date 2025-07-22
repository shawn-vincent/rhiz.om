import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import type { SpaceIntentions, SpacePresence } from "~/lib/state-sync-types";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { beings } from "~/server/db/schema";
import type { BeingId } from "~/server/db/types";
import {
	cleanupConnection,
	fetchSpaceIntentions,
	fetchSpacePresence,
	getStateManager,
} from "~/server/lib/state-sync";

// This forces the route to be dynamic and not cached
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	const session = await getServerAuthSession();

	if (!session?.user?.beingId) {
		return new Response("Unauthorized", { status: 401 });
	}

	const searchParams = request.nextUrl.searchParams;
	const model = searchParams.get("model");
	const spaceId = searchParams.get("spaceId");

	if (!model || !spaceId) {
		return new Response("Missing model or spaceId parameter", { status: 400 });
	}

	if (!["presence", "intentions"].includes(model)) {
		return new Response("Invalid model. Must be 'presence' or 'intentions'", {
			status: 400,
		});
	}

	// Verify user has access to this space (same logic as existing presence API)
	const userBeing = await db
		.select({ locationId: beings.locationId })
		.from(beings)
		.where(eq(beings.id, session.user.beingId))
		.limit(1);

	if (!userBeing[0] || userBeing[0].locationId !== spaceId) {
		return new Response("Forbidden - not in requested space", { status: 403 });
	}

	const connectionId = crypto.randomUUID();
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			try {
				// Get or create the appropriate state manager
				const manager =
					model === "presence"
						? await getStateManager<SpacePresence>("presence", spaceId, () =>
								fetchSpacePresence(spaceId as BeingId),
							)
						: await getStateManager<SpaceIntentions>(
								"intentions",
								spaceId,
								() => fetchSpaceIntentions(spaceId as BeingId),
							);

				// Add this connection to the manager
				manager.addSubscriber(connectionId, {
					controller,
					beingId: session.user.beingId ?? "",
					spaceId,
					model,
				});

				// Send initial snapshot
				const snapshot = manager.getSnapshot();
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`),
				);
			} catch (error) {
				console.error("Error setting up sync stream:", error);
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "error",
							message: "Failed to initialize stream",
						})}\n\n`,
					),
				);
				controller.close();
			}
		},
		cancel() {
			cleanupConnection(connectionId);
		},
	});

	// Clean up when the client closes the connection
	request.signal.addEventListener("abort", () => {
		cleanupConnection(connectionId);
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
			"Access-Control-Allow-Credentials": "true",
		},
	});
}
