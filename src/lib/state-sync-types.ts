// Shared types for state synchronization system
import type { Being, BeingId, Intention } from "~/server/db/types";

export interface VersionedState<T> {
	version: number;
	data: T;
	timestamp: string;
	changeInfo?: {
		type: "add" | "update" | "remove";
		entityId?: string;
		causedBy?: BeingId;
	};
}

export interface SpacePresence {
	spaceId: BeingId;
	beings: {
		being: Being;
		connectionStatus: "online" | "away" | "offline";
		lastSeen: string;
		joinedAt: string;
	}[];
}

export interface SpaceIntentions {
	spaceId: BeingId;
	intentions: Intention[];
}

export interface SyncError {
	type:
		| "auth_error"
		| "version_conflict"
		| "invalid_mutation"
		| "connection_error";
	message: string;
	currentVersion?: number;
}
