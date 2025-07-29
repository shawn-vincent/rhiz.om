import { EventEmitter } from "node:events";

// Unified sync event types
export interface SyncEvent {
	type: "being-created" | "being-updated" | "intention-created" | "intention-updated";
	data: { id: string };
	timestamp: string;
	locationId: string;
}

// Server-side singleton event emitter
const globalForSyncEmitter = globalThis as unknown as {
	syncEmitter: EventEmitter | undefined;
};

export const syncEmitter = globalForSyncEmitter.syncEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
	globalForSyncEmitter.syncEmitter = syncEmitter;
}

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