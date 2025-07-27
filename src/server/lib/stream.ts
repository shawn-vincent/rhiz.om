/**
 * Simple server-side sync
 *
 * Direct database → SSE broadcast. No classes, no heartbeats, no complexity.
 */
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { emitter } from "~/lib/events";
import { db } from "~/server/db";
import { beings, intentions } from "~/server/db/schema";
import { selectBeingSchema, selectIntentionSchema } from "~/server/db/types";
import type { Being, Intention } from "~/server/db/types";
import { logger } from "./logger";

// Sync event types
export type SyncEvent =
	| { type: "beings"; data: Being[] }
	| { type: "intentions"; data: Intention[] };

// Connection info
interface Connection {
	controller: ReadableStreamDefaultController;
	beingId?: string;
	spaceId?: string;
	types: string[];
}

// Active connections
const connections = new Map<string, Connection>();

// Add connection
export function addConnection(id: string, connection: Connection) {
	connections.set(id, connection);
	logger.debug(
		{ connectionId: id, total: connections.size },
		"Connection added",
	);
}

// Remove connection
export function removeConnection(id: string) {
	connections.delete(id);
	logger.debug(
		{ connectionId: id, total: connections.size },
		"Connection removed",
	);
}

// Get connection count
export function getActiveConnectionCount(): number {
	return connections.size;
}

// Send initial data when connection starts
export async function sendInitialData(connectionId: string) {
	const connection = connections.get(connectionId);
	if (!connection) return;

	try {
		if (connection.spaceId) {
			if (
				connection.types.length === 0 ||
				connection.types.includes("beings")
			) {
				const spaceBeings = await getSpaceBeings(connection.spaceId);
				sendToConnection(connectionId, { type: "beings", data: spaceBeings });
			}

			if (
				connection.types.length === 0 ||
				connection.types.includes("intentions")
			) {
				const spaceIntentions = await getSpaceIntentions(connection.spaceId);
				sendToConnection(connectionId, {
					type: "intentions",
					data: spaceIntentions,
				});
			}
		}

		logger.debug(
			{ connectionId, spaceId: connection.spaceId },
			"Initial data sent",
		);
	} catch (error) {
		logger.error({ connectionId, error }, "Failed to send initial data");
	}
}

// Send to specific connection
function sendToConnection(connectionId: string, event: SyncEvent) {
	const connection = connections.get(connectionId);
	if (!connection) return;

	try {
		const data = `data: ${superjson.stringify(event)}\n\n`;
		connection.controller.enqueue(new TextEncoder().encode(data));
	} catch (error) {
		logger.warn({ connectionId, error }, "Failed to send, removing connection");
		removeConnection(connectionId);
	}
}

// Broadcast to all matching connections
export function broadcast(
	event: SyncEvent,
	filter?: {
		spaceId?: string;
		types?: string[];
		beingId?: string;
	},
) {
	let sent = 0;
	for (const [connectionId, connection] of connections) {
		// Apply filters
		if (filter?.spaceId && connection.spaceId !== filter.spaceId) continue;
		if (filter?.beingId && connection.beingId !== filter.beingId) continue;
		if (
			filter?.types &&
			connection.types.length > 0 &&
			!filter.types.some((type) => connection.types.includes(type))
		)
			continue;

		sendToConnection(connectionId, event);
		sent++;
	}

	logger.debug(
		{
			eventType: event.type,
			totalConnections: connections.size,
			sent,
			filter,
		},
		"Event broadcasted",
	);
}

// Get beings in a space
async function getSpaceBeings(spaceId: string): Promise<Being[]> {
	const beingsData = await db.query.beings.findMany({
		where: eq(beings.locationId, spaceId),
		orderBy: (beings, { asc }) => [asc(beings.name)],
	});
	return beingsData.map((being) => selectBeingSchema.parse(being));
}

// Get intentions in a space
async function getSpaceIntentions(spaceId: string): Promise<Intention[]> {
	const intentionsData = await db.query.intentions.findMany({
		where: eq(intentions.locationId, spaceId),
		orderBy: (intentions, { desc }) => [desc(intentions.createdAt)],
		limit: 50,
	});
	return intentionsData.map((intention) =>
		selectIntentionSchema.parse(intention),
	);
}

// Setup event listeners
emitter.on("being:updated", async (beingId: string, spaceId?: string) => {
	if (!spaceId) return;
	try {
		const spaceBeings = await getSpaceBeings(spaceId);
		broadcast(
			{ type: "beings", data: spaceBeings },
			{ spaceId, types: ["beings"] },
		);
	} catch (error) {
		logger.error({ beingId, spaceId, error }, "Failed to handle being update");
	}
});

emitter.on(
	"intention:created",
	async (intentionId: string, spaceId: string) => {
		try {
			const spaceIntentions = await getSpaceIntentions(spaceId);
			broadcast(
				{ type: "intentions", data: spaceIntentions },
				{ spaceId, types: ["intentions"] },
			);
		} catch (error) {
			logger.error(
				{ intentionId, spaceId, error },
				"Failed to handle intention update",
			);
		}
	},
);

// Direct notification functions
export function notifyBeingUpdate(beingId: string, spaceId?: string) {
	emitter.emit("being:updated", beingId, spaceId);
}

export function notifyIntentionCreated(intentionId: string, spaceId: string) {
	emitter.emit("intention:created", intentionId, spaceId);
}

logger.info("Sync event listeners setup complete");
