/**
 * Simple client-side sync
 *
 * Direct EventSource → callbacks. No queues, no classes, no complexity.
 */
import superjson from "superjson";
import type { Being, Intention } from "~/server/db/types";
import { logger } from "./logger.client";

// Sync event types
export type SyncEvent =
	| { type: "beings"; data: Being[] }
	| { type: "intentions"; data: Intention[] };

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

// Connect to sync stream (reuses existing connections)
export function connect(spaceId: string): string {
	const connectionId = crypto.randomUUID();
	connectionToSpaceId.set(connectionId, spaceId);

	// Reuse existing connection for same spaceId
	let connection = connections.get(spaceId);
	if (connection) {
		connection.subscribers.add(connectionId);
		return connectionId;
	}

	// Create new connection
	const url = `/api/stream?spaceId=${encodeURIComponent(spaceId)}`;
	const eventSource = new EventSource(url);
	const callbacks = new Set<(event: SyncEvent) => void>();
	const subscribers = new Set([connectionId]);

	connection = { eventSource, callbacks, subscribers };
	connections.set(spaceId, connection);

	eventSource.onmessage = (event) => {
		try {
			const syncEvent = superjson.parse(event.data) as SyncEvent;
			for (const callback of callbacks) {
				callback(syncEvent);
			}
		} catch (error) {
			logger.error({ error }, "Failed to parse sync event");
		}
	};

	eventSource.onerror = () => {
		logger.warn("Sync connection error");
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
