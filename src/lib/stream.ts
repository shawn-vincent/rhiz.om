/**
 * Real-time client-side sync
 *
 * Single space-delta event with timestamp-based catch-up.
 * Includes both beings and intentions for real-time updates.
 */
import superjson from "superjson";
import type { Being, Intention } from "~/server/db/types";
import { logger } from "./logger.client";

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

// Timestamp tracking per space
const spaceTimestamps = new Map<string, string>();

// Active connections by spaceId (shared)
const connections = new Map<
	string,
	{
		eventSource: EventSource;
		callbacks: Set<(event: SyncEvent) => void>;
		subscribers: Set<string>; // Track who's using this connection
	}
>();

// Connection ID to spaceId mapping
const connectionToSpaceId = new Map<string, string>();

// Connect to sync stream with timestamp catch-up
export function connect(spaceId: string): string {
	const connectionId = crypto.randomUUID();
	connectionToSpaceId.set(connectionId, spaceId);

	// Reuse existing connection for same spaceId
	let connection = connections.get(spaceId);
	if (connection) {
		connection.subscribers.add(connectionId);
		return connectionId;
	}

	// Create new connection with timestamp catch-up
	const lastTimestamp = spaceTimestamps.get(spaceId);
	const sinceParam = lastTimestamp
		? `&since=${encodeURIComponent(lastTimestamp)}`
		: "";
	const url = `/api/stream?spaceId=${encodeURIComponent(spaceId)}${sinceParam}`;

	const eventSource = new EventSource(url);
	const callbacks = new Set<(event: SyncEvent) => void>();
	const subscribers = new Set([connectionId]);

	connection = { eventSource, callbacks, subscribers };
	connections.set(spaceId, connection);

	eventSource.onmessage = (event) => {
		try {
			const syncEvent = superjson.parse(event.data) as SyncEvent;

			// Track latest timestamp for catch-up
			spaceTimestamps.set(spaceId, syncEvent.timestamp);

			for (const callback of callbacks) {
				callback(syncEvent);
			}
		} catch (error) {
			logger.error({ error }, "Failed to parse sync event");
		}
	};

	eventSource.onerror = () => {
		logger.warn("Sync connection error - will attempt reconnect");
	};

	return connectionId;
}

// Disconnect from sync stream
export function disconnect(connectionId: string) {
	const spaceId = connectionToSpaceId.get(connectionId);
	if (!spaceId) return;

	const connection = connections.get(spaceId);
	if (!connection) return;

	// Remove this subscriber
	connection.subscribers.delete(connectionId);
	connectionToSpaceId.delete(connectionId);

	// If no more subscribers, close the connection
	if (connection.subscribers.size === 0) {
		connection.eventSource.close();
		connections.delete(spaceId);
	}
}

// Subscribe to sync events
export function subscribe(
	connectionId: string,
	callback: (event: SyncEvent) => void,
) {
	const spaceId = connectionToSpaceId.get(connectionId);
	if (!spaceId) return () => {};

	const connection = connections.get(spaceId);
	if (connection) {
		connection.callbacks.add(callback);
	}
	return () => {
		const connection = connections.get(spaceId);
		if (connection) {
			connection.callbacks.delete(callback);
		}
	};
}

// Get connection state
export function isConnected(connectionId: string): boolean {
	const spaceId = connectionToSpaceId.get(connectionId);
	if (!spaceId) return false;

	const connection = connections.get(spaceId);
	return connection?.eventSource.readyState === EventSource.OPEN || false;
}
