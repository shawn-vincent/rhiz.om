// Unified sync event types
export interface SyncEvent {
	type:
		| "being-created"
		| "being-updated"
		| "intention-created"
		| "intention-updated";
	data: { id: string };
	timestamp: string;
	locationId: string;
}

// Server-side singleton event emitter (only available on server)
let serverEventEmitter: any = null;

if (typeof window === "undefined") {
	// Only import EventEmitter on server side
	const { EventEmitter } = require("node:events");

	const globalForSyncEmitter = globalThis as unknown as {
		syncEmitter: any | undefined;
	};

	serverEventEmitter = globalForSyncEmitter.syncEmitter ?? new EventEmitter();

	if (process.env.NODE_ENV !== "production") {
		globalForSyncEmitter.syncEmitter = serverEventEmitter;
	}
}

export const syncEmitter = serverEventEmitter;

// Client-side sync interface
export interface SyncClient {
	connect(locationId: string): Promise<void>;
	disconnect(): Promise<void>;
	isConnected: boolean;
	subscribe(callback: (event: SyncEvent) => void): () => void;
}

// Server-side sync interface
export interface SyncServer {
	broadcast(event: SyncEvent): Promise<void>;
}
