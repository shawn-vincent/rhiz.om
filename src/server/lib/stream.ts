/**
 * Real-time sync system with being and intention deltas
 *
 * Single space-delta event with timestamp-based catch-up.
 * Includes both beings and intentions for real-time updates.
 */
import { and, eq, gt } from "drizzle-orm";
import superjson from "superjson";
import { emitter } from "~/lib/events";
import { db } from "~/server/db";
import { beings, intentions } from "~/server/db/schema";
import { selectBeingSchema, selectIntentionSchema } from "~/server/db/types";
import type { Being, Intention } from "~/server/db/types";
import { logger } from "./logger";

// Sync event with both intention and being deltas
export type SyncEvent = {
	type: "space-delta";
	intentions: {
		created: Intention[];
		updated: Intention[];
		deleted: string[];
	};
	beings: {
		created: Being[];
		updated: Being[];
		deleted: string[];
	};
	timestamp: string;
};

// Connection info
interface Connection {
	controller: ReadableStreamDefaultController;
	beingId?: string;
	spaceId: string;
}

// Active connections
const connections = new Map<string, Connection>();

// Delta batching per space (1-second window)
const deltaBuffers = new Map<
	string,
	{
		intentions: {
			created: Set<string>;
			updated: Set<string>;
			deleted: Set<string>;
		};
		beings: {
			created: Set<string>;
			updated: Set<string>;
			deleted: Set<string>;
		};
		timeout?: NodeJS.Timeout;
	}
>();

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

// Get intentions since timestamp for catch-up
async function getIntentionsSince(
	spaceId: string,
	since?: string,
): Promise<Intention[]> {
	const whereClause = since
		? and(
				eq(intentions.locationId, spaceId),
				gt(intentions.createdAt, new Date(since)),
			)
		: eq(intentions.locationId, spaceId);

	const intentionsData = await db.query.intentions.findMany({
		where: whereClause,
		orderBy: (intentions, { asc }) => [asc(intentions.createdAt)],
		limit: 50, // Cap at 50 messages per catch-up
	});

	return intentionsData.map((intention) =>
		selectIntentionSchema.parse(intention),
	);
}

// Get beings since timestamp for catch-up
async function getBeingsSince(
	spaceId: string,
	since?: string,
): Promise<Being[]> {
	const whereClause = since
		? and(
				eq(beings.locationId, spaceId),
				gt(beings.modifiedAt, new Date(since)),
			)
		: eq(beings.locationId, spaceId);

	const beingsData = await db.query.beings.findMany({
		where: whereClause,
		orderBy: (beings, { asc }) => [asc(beings.name)],
	});

	return beingsData.map((being) =>
		selectBeingSchema.parse(being),
	);
}

// Send initial data or catch-up delta
export async function sendInitialData(connectionId: string, since?: string) {
	const connection = connections.get(connectionId);
	if (!connection) return;

	try {
		const [recentIntentions, recentBeings] = await Promise.all([
			getIntentionsSince(connection.spaceId, since),
			getBeingsSince(connection.spaceId, since),
		]);

		// Send delta with recent data
		const delta: SyncEvent = {
			type: "space-delta",
			intentions: {
				created: recentIntentions,
				updated: [],
				deleted: [],
			},
			beings: {
				created: recentBeings,
				updated: [],
				deleted: [],
			},
			timestamp: new Date().toISOString(),
		};

		sendToConnection(connectionId, delta);

		logger.debug(
			{
				connectionId,
				spaceId: connection.spaceId,
				intentionCount: recentIntentions.length,
				since,
			},
			"Initial delta sent",
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

// Broadcast delta to all matching connections
function broadcastDelta(spaceId: string, delta: SyncEvent) {
	let sent = 0;
	for (const [connectionId, connection] of connections) {
		if (connection.spaceId === spaceId) {
			sendToConnection(connectionId, delta);
			sent++;
		}
	}

	logger.debug(
		{
			spaceId,
			totalConnections: connections.size,
			sent,
			intentionsCreated: delta.intentions.created.length,
			intentionsUpdated: delta.intentions.updated.length,
			intentionsDeleted: delta.intentions.deleted.length,
			beingsCreated: delta.beings.created.length,
			beingsUpdated: delta.beings.updated.length,
			beingsDeleted: delta.beings.deleted.length,
		},
		"Delta broadcasted",
	);
}

// Add intention to delta buffer
function bufferIntentionChange(
	spaceId: string,
	intentionId: string,
	type: "created" | "updated" | "deleted",
) {
	let buffer = deltaBuffers.get(spaceId);
	if (!buffer) {
		buffer = {
			intentions: {
				created: new Set(),
				updated: new Set(),
				deleted: new Set(),
			},
			beings: {
				created: new Set(),
				updated: new Set(),
				deleted: new Set(),
			},
		};
		deltaBuffers.set(spaceId, buffer);
	}

	// Add to appropriate set
	buffer.intentions[type].add(intentionId);

	// Clear any existing timeout and set new one (1-second batching)
	if (buffer.timeout) {
		clearTimeout(buffer.timeout);
	}

	buffer.timeout = setTimeout(() => {
		flushDeltaBuffer(spaceId);
	}, 1000);
}

// Add being to delta buffer
function bufferBeingChange(
	spaceId: string,
	beingId: string,
	type: "created" | "updated" | "deleted",
) {
	let buffer = deltaBuffers.get(spaceId);
	if (!buffer) {
		buffer = {
			intentions: {
				created: new Set(),
				updated: new Set(),
				deleted: new Set(),
			},
			beings: {
				created: new Set(),
				updated: new Set(),
				deleted: new Set(),
			},
		};
		deltaBuffers.set(spaceId, buffer);
	}

	// Add to appropriate set
	buffer.beings[type].add(beingId);

	// Clear any existing timeout and set new one (1-second batching)
	if (buffer.timeout) {
		clearTimeout(buffer.timeout);
	}

	buffer.timeout = setTimeout(() => {
		flushDeltaBuffer(spaceId);
	}, 1000);
}

// Flush buffered deltas for a space
async function flushDeltaBuffer(spaceId: string) {
	const buffer = deltaBuffers.get(spaceId);
	if (!buffer) return;

	try {
		// Fetch recent data for both intentions and beings
		// This is simpler than trying to track individual IDs
		const [recentIntentions, recentBeings] = await Promise.all([
			getIntentionsSince(spaceId),
			getBeingsSince(spaceId),
		]);

		// For simplicity, treat all as "created" since distinguishing created vs updated
		// is complex and not critical for real-time sync
		const delta: SyncEvent = {
			type: "space-delta",
			intentions: {
				created: recentIntentions,
				updated: [],
				deleted: Array.from(buffer.intentions.deleted),
			},
			beings: {
				created: recentBeings,
				updated: [],
				deleted: Array.from(buffer.beings.deleted),
			},
			timestamp: new Date().toISOString(),
		};

		// Broadcast if there are any changes
		const hasChanges = 
			recentIntentions.length > 0 || 
			recentBeings.length > 0 ||
			buffer.intentions.deleted.size > 0 ||
			buffer.beings.deleted.size > 0;

		if (hasChanges) {
			broadcastDelta(spaceId, delta);
		}

		// Clear buffer
		deltaBuffers.delete(spaceId);
	} catch (error) {
		logger.error({ spaceId, error }, "Failed to flush delta buffer");
		// Clear buffer even on error to prevent infinite loops
		deltaBuffers.delete(spaceId);
	}
}

// Setup event listeners for both intentions and beings
emitter.on(
	"intention:created",
	async (intentionId: string, spaceId: string) => {
		bufferIntentionChange(spaceId, intentionId, "created");
	},
);

emitter.on(
	"being:created",
	async (beingId: string, spaceId: string) => {
		bufferBeingChange(spaceId, beingId, "created");
	},
);

emitter.on(
	"being:updated",
	async (beingId: string, spaceId: string) => {
		bufferBeingChange(spaceId, beingId, "updated");
	},
);

// Direct notification functions
export function notifyIntentionCreated(intentionId: string, spaceId: string) {
	emitter.emit("intention:created", intentionId, spaceId);
}

export function notifyBeingCreated(beingId: string, spaceId: string) {
	emitter.emit("being:created", beingId, spaceId);
}

export function notifyBeingUpdated(beingId: string, spaceId: string) {
	emitter.emit("being:updated", beingId, spaceId);
}

logger.info("Real-time sync event listeners setup complete (beings + intentions)");
