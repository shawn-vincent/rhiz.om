import { EventEmitter } from "node:events";
import { eq } from "drizzle-orm";
import type {
	SpaceIntentions,
	SpacePresence,
	VersionedState,
} from "~/lib/state-sync-types";
import { emitter } from "~/lib/events";
import { db } from "~/server/db";
import { beings, intentions } from "~/server/db/schema";
import type { Being, BeingId, Intention, IntentionId } from "~/server/db/types";

// Connection tracking (reuse from existing presence system)
interface SSEConnection {
	controller: ReadableStreamDefaultController;
	beingId: string;
	spaceId: string;
	dataType: string;
	lastHeartbeat: number;
}

// Global connection tracking
const connections = new Map<string, SSEConnection>();
const beingConnections = new Map<string, Set<string>>();

// State managers by model and space
const stateManagers = new Map<string, StateManager<unknown>>();

const HEARTBEAT_INTERVAL = 15000; // 15 seconds
const CONNECTION_TIMEOUT = 35000; // 35 seconds

// Global cleanup interval for stale connections
setInterval(() => {
	const now = Date.now();
	const staleConnections: string[] = [];

	for (const [connectionId, info] of connections) {
		if (now - info.lastHeartbeat > CONNECTION_TIMEOUT) {
			staleConnections.push(connectionId);
		}
	}

	for (const connectionId of staleConnections) {
		console.log(`Cleaning up stale connection: ${connectionId}`);
		cleanupConnection(connectionId);
	}
}, HEARTBEAT_INTERVAL);

function getManagerKey(dataType: string, spaceId: string): string {
	return `${dataType}:${spaceId}`;
}

export class StateManager<T> {
	private currentVersion = 0;
	private currentState: T;
	private readonly emitter = new EventEmitter();
	private readonly dataType: string;
	private readonly spaceId: string;
	private heartbeatTimer?: NodeJS.Timeout;

	constructor(dataType: string, spaceId: string, initialState: T) {
		this.dataType = dataType;
		this.spaceId = spaceId;
		this.currentState = initialState;
		this.currentVersion = 1; // Start at version 1
		this.startHeartbeat();
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

		// Emit for server-side listeners
		this.emitter.emit('change', versionedState);

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

	subscribe(listener: (data: VersionedState<T>) => void): () => void {
		this.emitter.on('change', listener);
		return () => this.emitter.off('change', listener);
	}

	getCurrentState(): T {
		return this.currentState;
	}

	private startHeartbeat() {
		this.heartbeatTimer = setInterval(() => {
			this.broadcast({ type: "heartbeat" });
		}, HEARTBEAT_INTERVAL);
	}

	private stopHeartbeat() {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
		}
	}

	private broadcast(payload: VersionedState<T> | { type: "heartbeat" }): void {
		const encoder = new TextEncoder();
		let encodedData: Uint8Array;

		if ("type" in payload && payload.type === "heartbeat") {
			// This is a comment, it will keep the connection alive but won't trigger onmessage
			encodedData = encoder.encode(`: heartbeat\n\n`);
		} else {
			const data = `data: ${JSON.stringify(payload)}\n\n`;
			encodedData = encoder.encode(data);
		}

		// Send to all connections subscribed to this dataType+space
		for (const [connectionId, connection] of connections) {
			if (
				connection.dataType === this.dataType &&
				connection.spaceId === this.spaceId
			) {
				try {
					connection.controller.enqueue(encodedData);
					// If we successfully send data, update the heartbeat
					connection.lastHeartbeat = Date.now();
				} catch (error) {
					// Connection closed, schedule for cleanup
					console.log(`Error enqueuing data for ${connectionId}, scheduling cleanup.`);
					cleanupConnection(connectionId);
				}
			}
		}
	}

	addSubscriber(connectionId: string, connection: SSEConnection): void {
		connection.lastHeartbeat = Date.now();
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

	destroy() {
		this.stopHeartbeat();
	}
}

// Factory function to get or create state managers
export function getStateManager<T>(
	spaceId: string,
	dataType: string,
	initialStateFactory: () => Promise<T>,
): Promise<StateManager<T>> {
	const key = getManagerKey(dataType, spaceId);

	const existingManager = stateManagers.get(key);
	if (existingManager) {
		return Promise.resolve(existingManager as StateManager<T>);
	}

	return initialStateFactory().then((initialState) => {
		const manager = new StateManager(dataType, spaceId, initialState);
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
	const manager = await getStateManager(spaceId, "presence", () =>
		fetchSpacePresence(spaceId),
	);
	const newState = await fetchSpacePresence(spaceId);
	manager.updateState(newState, changeInfo);
}

export async function triggerIntentionsUpdate(
	spaceId: BeingId,
	changeInfo?: VersionedState<SpaceIntentions>["changeInfo"],
) {
	const manager = await getStateManager(spaceId, "intentions", () =>
		fetchSpaceIntentions(spaceId),
	);
	const newState = await fetchSpaceIntentions(spaceId);
	manager.updateState(newState, changeInfo);
}

// Global bot event listener
export function onBotLocationChange(callback: (beingId: string, spaceId: string | null, oldSpaceId: string | null) => void): () => void {
	const handler = (data: { beingId: string, spaceId: string | null, oldSpaceId: string | null }) => {
		callback(data.beingId, data.spaceId, data.oldSpaceId);
	};
	
	emitter.on('bot-location-change', handler);
	return () => emitter.off('bot-location-change', handler);
}

// Cleanup function
export function cleanupConnection(connectionId: string) {
	const connection = connections.get(connectionId);
	if (!connection) return;

	try {
		connection.controller.close();
	} catch (e) {
		// May already be closed
	}

	// Find the appropriate manager and remove subscriber
	const key = getManagerKey(connection.dataType, connection.spaceId);
	const manager = stateManagers.get(key);
	if (manager) {
		manager.removeSubscriber(connectionId);
	} else {
		// If manager doesn't exist, remove from connections manually
		connections.delete(connectionId);
	}

	// If this was a presence connection, trigger presence update
	if (connection.dataType === "presence") {
		// Use a timeout to allow the connection to be fully removed before updating presence
		setTimeout(() => {
			triggerPresenceUpdate(connection.spaceId as BeingId, {
				type: "update",
				entityId: connection.beingId,
				causedBy: connection.beingId as BeingId,
			});
		}, 100);
	}
}
