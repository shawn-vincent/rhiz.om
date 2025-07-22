import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import type { SpaceIntentions, SpacePresence } from "~/lib/state-sync-types";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { beings } from "~/server/db/schema";
import type { BeingId } from "~/server/db/types";
import {
	fetchSpaceIntentions,
	fetchSpacePresence,
	getStateManager,
} from "~/server/lib/state-sync";

export async function GET(request: NextRequest) {
	const session = await getServerAuthSession();

	if (!session?.user?.beingId) {
		return new Response("Unauthorized", { status: 401 });
	}

	const searchParams = request.nextUrl.searchParams;
	const dataType = searchParams.get("model");
	const spaceId = searchParams.get("spaceId");

	if (!dataType || !spaceId) {
		return new Response("Missing model or spaceId parameter", { status: 400 });
	}

	if (!["presence", "intentions"].includes(dataType)) {
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

	try {
		// Get or create the appropriate state manager
		const manager =
			dataType === "presence"
				? await getStateManager<SpacePresence>(spaceId, "presence", () =>
						fetchSpacePresence(spaceId as BeingId),
					)
				: await getStateManager<SpaceIntentions>(spaceId, "intentions", () =>
						fetchSpaceIntentions(spaceId as BeingId),
					);

		// Return current snapshot
		const snapshot = manager.getSnapshot();

		return new Response(JSON.stringify(snapshot), {
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-cache",
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type",
				"Access-Control-Allow-Credentials": "true",
			},
		});
	} catch (error) {
		console.error("Error fetching snapshot:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to fetch snapshot",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
