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

// Active connections
const connections = new Map<
	string,
	{
		eventSource: EventSource;
		callbacks: Set<(event: SyncEvent) => void>;
	}
>();

// Connect to sync stream
export function connect(spaceId?: string, types?: string[]): string {
	const params = new URLSearchParams();
	if (spaceId) params.set("spaceId", spaceId);
	if (types?.length) params.set("types", types.join(","));

	const connectionId = crypto.randomUUID();
	const url = `/api/stream?${params.toString()}`;
	const eventSource = new EventSource(url);
	const callbacks = new Set<(event: SyncEvent) => void>();

	connections.set(connectionId, { eventSource, callbacks });

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
	const connection = connections.get(connectionId);
	if (connection) {
		connection.eventSource.close();
		connections.delete(connectionId);
	}
}

// Subscribe to sync events
export function subscribe(
	connectionId: string,
	callback: (event: SyncEvent) => void,
) {
	const connection = connections.get(connectionId);
	if (connection) {
		connection.callbacks.add(callback);
	}
	return () => {
		const connection = connections.get(connectionId);
		if (connection) {
			connection.callbacks.delete(callback);
		}
	};
}

// Get connection state
export function isConnected(connectionId: string): boolean {
	const connection = connections.get(connectionId);
	return connection?.eventSource.readyState === EventSource.OPEN || false;
}
