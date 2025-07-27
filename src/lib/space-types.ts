import type { Being, BeingId, Intention } from "~/server/db/types";

// Being types from entity-kit
export type BeingType = "space" | "guest" | "bot" | "document";

export interface EntitySummary {
	id: string;
	name: string;
	type: BeingType;
	avatarUrl?: string;
}

// Extended being type with presence info
export interface BeingWithPresence extends Being {
	isOnline: boolean;
}

// Simple space data structure matching server
export interface SpaceData {
	version: number;
	timestamp: string;
	beings: BeingWithPresence[];
	intentions: Intention[];
	spaceId: BeingId;
}

// Connection states
export type ConnectionState =
	| "connecting"
	| "connected"
	| "error"
	| "disconnected";