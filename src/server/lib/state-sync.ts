import { EventEmitter } from "node:events";
import { eq } from "drizzle-orm";
import type {
	SpaceIntentions,
	SpacePresence,
	VersionedState,
} from "~/lib/state-sync-types";
import { db } from "~/server/db";
import { beings, intentions } from "~/server/db/schema";
import type { Being, BeingId, Intention, IntentionId } from "~/server/db/types";

// Connection tracking (reuse from existing presence system)
interface SSEConnection {
	controller: ReadableStreamDefaultController;
	beingId: string;
	spaceId: string;
	model: string;
}

// Global connection tracking
const connections = new Map<string, SSEConnection>();
const beingConnections = new Map<string, Set<string>>();

// State managers by model and space
const stateManagers = new Map<string, StateManager<unknown>>();

function getManagerKey(model: string, spaceId: string): string {
	return `${model}:${spaceId}`;
}

export class StateManager<T> {
	private currentVersion = 0;
	private currentState: T;
	private readonly emitter = new EventEmitter();
	private readonly model: string;
	private readonly spaceId: string;

	constructor(model: string, spaceId: string, initialState: T) {
		this.model = model;
		this.spaceId = spaceId;
		this.currentState = initialState;
		this.currentVersion = 1; // Start at version 1
	}

	updateState(newState: T, changeInfo?: VersionedState<T>["changeInfo"]): void {
		this.currentVersion++;
		this.currentState = newState;

		const versionedState: VersionedState<T> = {
			version: this.currentVersion,
			data: newState,
			timestamp: new Date().toISOString(),
			changeInfo,
		};

		// Broadcast to all subscribers for this model+space
		this.broadcast(versionedState);
	}

	getSnapshot(): VersionedState<T> {
		return {
			version: this.currentVersion,
			data: this.currentState,
			timestamp: new Date().toISOString(),
		};
	}

	private broadcast(versionedState: VersionedState<T>): void {
		const encoder = new TextEncoder();
		const data = `data: ${JSON.stringify(versionedState)}\n\n`;
		const encodedData = encoder.encode(data);

		// Send to all connections subscribed to this model+space
		for (const [connectionId, connection] of connections) {
			if (
				connection.model === this.model &&
				connection.spaceId === this.spaceId
			) {
				try {
					connection.controller.enqueue(encodedData);
				} catch (error) {
					// Connection closed, will be cleaned up
					connections.delete(connectionId);
				}
			}
		}
	}

	addSubscriber(connectionId: string, connection: SSEConnection): void {
		connections.set(connectionId, connection);

		// Update being connections index for presence tracking
		if (!beingConnections.has(connection.beingId)) {
			beingConnections.set(connection.beingId, new Set());
		}
		beingConnections.get(connection.beingId)?.add(connectionId);
	}

	removeSubscriber(connectionId: string): void {
		const connection = connections.get(connectionId);
		if (connection) {
			connections.delete(connectionId);

			// Update being connections index
			const beingConns = beingConnections.get(connection.beingId);
			if (beingConns) {
				beingConns.delete(connectionId);
				if (beingConns.size === 0) {
					beingConnections.delete(connection.beingId);
				}
			}
		}
	}
}

// Factory function to get or create state managers
export function getStateManager<T>(
	model: string,
	spaceId: string,
	initialStateFactory: () => Promise<T>,
): Promise<StateManager<T>> {
	const key = getManagerKey(model, spaceId);

	const existingManager = stateManagers.get(key);
	if (existingManager) {
		return Promise.resolve(existingManager as StateManager<T>);
	}

	return initialStateFactory().then((initialState) => {
		const manager = new StateManager(model, spaceId, initialState);
		stateManagers.set(key, manager);
		return manager;
	});
}

// Data fetchers for different models
export async function fetchSpacePresence(
	spaceId: BeingId,
): Promise<SpacePresence> {
	// Get all beings in the space
	const beingsInSpace = await db
		.select()
		.from(beings)
		.where(eq(beings.locationId, spaceId));

	return {
		spaceId,
		beings: beingsInSpace.map((being) => ({
			being: being as Being,
			connectionStatus: (isBeingOnline(being.id, being.type)
				? "online"
				: "offline") as "online" | "away" | "offline",
			lastSeen: new Date().toISOString(), // TODO: Track actual last seen
			joinedAt: being.modifiedAt.toISOString(), // When they set location to this space
		})),
	};
}

export async function fetchSpaceIntentions(
	spaceId: BeingId,
): Promise<SpaceIntentions> {
	// Get all intentions in the space
	const spaceIntentions = await db
		.select()
		.from(intentions)
		.where(eq(intentions.locationId, spaceId));

	return {
		spaceId,
		intentions: spaceIntentions as Intention[],
	};
}

// Helper functions (reuse logic from existing presence system)
export function isBeingOnline(beingId: string, beingType: string): boolean {
	// Spaces and bots are always "online"
	if (beingType === "space" || beingType === "bot") {
		return true;
	}
	return beingConnections.has(beingId);
}

// Trigger state updates when data changes
export async function triggerPresenceUpdate(
	spaceId: BeingId,
	changeInfo?: VersionedState<SpacePresence>["changeInfo"],
) {
	const manager = await getStateManager("presence", spaceId, () =>
		fetchSpacePresence(spaceId),
	);
	const newState = await fetchSpacePresence(spaceId);
	manager.updateState(newState, changeInfo);
}

export async function triggerIntentionsUpdate(
	spaceId: BeingId,
	changeInfo?: VersionedState<SpaceIntentions>["changeInfo"],
) {
	const manager = await getStateManager("intentions", spaceId, () =>
		fetchSpaceIntentions(spaceId),
	);
	const newState = await fetchSpaceIntentions(spaceId);
	manager.updateState(newState, changeInfo);
}

// Cleanup function
export function cleanupConnection(connectionId: string) {
	const connection = connections.get(connectionId);
	if (!connection) return;

	// Find the appropriate manager and remove subscriber
	const key = getManagerKey(connection.model, connection.spaceId);
	const manager = stateManagers.get(key);
	if (manager) {
		manager.removeSubscriber(connectionId);
	}

	// If this was a presence connection, trigger presence update
	if (connection.model === "presence") {
		triggerPresenceUpdate(connection.spaceId as BeingId, {
			type: "update",
			entityId: connection.beingId,
			causedBy: connection.beingId as BeingId,
		});
	}
}
