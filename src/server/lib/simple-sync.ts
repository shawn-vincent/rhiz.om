import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { beings, intentions } from "~/server/db/schema";
import type { Being, BeingId, Intention } from "~/server/db/types";

// Simple space data structure
export interface SpaceData {
	version: number;
	timestamp: string;
	beings: Being[];
	intentions: Intention[];
	spaceId: BeingId;
}

// Global state management
const spaceVersions = new Map<string, number>();
const spaceConnections = new Map<
	string,
	Set<ReadableStreamDefaultController>
>();

// Increment version for a space
function incrementSpaceVersion(spaceId: BeingId): number {
	const currentVersion = spaceVersions.get(spaceId) || 0;
	const newVersion = currentVersion + 1;
	spaceVersions.set(spaceId, newVersion);
	return newVersion;
}

// Get current version for a space
function getSpaceVersion(spaceId: BeingId): number {
	return spaceVersions.get(spaceId) || 1;
}

// Add connection to space
export function addSpaceConnection(
	spaceId: BeingId,
	controller: ReadableStreamDefaultController,
): void {
	if (!spaceConnections.has(spaceId)) {
		spaceConnections.set(spaceId, new Set());
	}
	spaceConnections.get(spaceId)?.add(controller);
}

// Remove connection from space
export function removeSpaceConnection(
	spaceId: BeingId,
	controller: ReadableStreamDefaultController,
): void {
	const connections = spaceConnections.get(spaceId);
	if (connections) {
		connections.delete(controller);
		if (connections.size === 0) {
			spaceConnections.delete(spaceId);
		}
	}
}

// Fetch complete space data
export async function fetchSpaceData(spaceId: BeingId): Promise<SpaceData> {
	// Fetch beings in this space
	const spaceBeings = await db.query.beings.findMany({
		where: eq(beings.locationId, spaceId),
		orderBy: (beings, { asc }) => [asc(beings.name)],
	});

	// Fetch intentions in this space
	const spaceIntentions = await db.query.intentions.findMany({
		where: eq(intentions.locationId, spaceId),
		orderBy: (intentions, { asc }) => [asc(intentions.createdAt)],
	});

	return {
		version: getSpaceVersion(spaceId),
		timestamp: new Date().toISOString(),
		beings: spaceBeings as Being[],
		intentions: spaceIntentions as Intention[],
		spaceId,
	};
}

// Trigger update for a space (increment version and broadcast)
export async function triggerSpaceUpdate(spaceId: BeingId): Promise<void> {
	// Increment version
	const newVersion = incrementSpaceVersion(spaceId);

	// Get all data for this space
	const spaceData = await fetchSpaceData(spaceId);

	// Broadcast to all connected clients
	const connections = spaceConnections.get(spaceId);
	if (connections && connections.size > 0) {
		const encoder = new TextEncoder();
		const message = `data: ${JSON.stringify(spaceData)}\n\n`;
		const encodedMessage = encoder.encode(message);

		// Send to all connections, removing any that are closed
		const closedConnections: ReadableStreamDefaultController[] = [];

		for (const controller of connections) {
			try {
				controller.enqueue(encodedMessage);
			} catch (error) {
				// Connection is closed, mark for removal
				closedConnections.push(controller);
			}
		}

		// Clean up closed connections
		for (const closedController of closedConnections) {
			connections.delete(closedController);
		}

		// If no connections left, remove the space entry
		if (connections.size === 0) {
			spaceConnections.delete(spaceId);
		}
	}
}

// Heartbeat system - send periodic keepalive messages
setInterval(() => {
	const encoder = new TextEncoder();
	const heartbeat = encoder.encode(": heartbeat\n\n");

	for (const [spaceId, connections] of spaceConnections) {
		const closedConnections: ReadableStreamDefaultController[] = [];

		for (const controller of connections) {
			try {
				controller.enqueue(heartbeat);
			} catch (error) {
				closedConnections.push(controller);
			}
		}

		// Clean up closed connections
		for (const closedController of closedConnections) {
			connections.delete(closedController);
		}

		if (connections.size === 0) {
			spaceConnections.delete(spaceId);
		}
	}
}, 30000); // 30 second heartbeat
