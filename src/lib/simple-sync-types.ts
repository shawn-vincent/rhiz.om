import type { Being, BeingId, Intention } from "~/server/db/types";

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

// API request/response types
export interface BeingRequest {
	action: "get" | "list" | "create" | "update" | "delete";
	spaceId?: string;
	beingId?: string;
	data?: Partial<Being>;
}

export interface BeingResponse {
	success: boolean;
	data?: Being | Being[];
	error?: string;
	version?: number;
}

export interface IntentionRequest {
	action: "get" | "list" | "create" | "update" | "delete";
	spaceId?: string;
	intentionId?: string;
	data?: {
		name?: string;
		type?: "utterance" | "error";
		state?: "draft" | "active" | "paused" | "complete" | "cancelled" | "failed";
		content?: any[];
	};
}

export interface IntentionResponse {
	success: boolean;
	data?: Intention | Intention[];
	error?: string;
	version?: number;
}
