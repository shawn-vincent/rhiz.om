import { Room } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BeingId } from "~/lib/types";
import { api } from "~/trpc/react";

export type ConnectionState =
	| "disconnected"
	| "connecting"
	| "connected"
	| "failed";

// Shared connection state per location
const connectionMap = new Map<
	BeingId,
	{
		room: Room | null;
		connectionState: ConnectionState;
		subscribers: Set<() => void>;
		connectionPromise: Promise<void> | null;
	}
>();

/**
 * Shared LiveKit connection hook that manages one connection per location
 * Multiple components can use the same connection without conflicts
 */
export function useSharedLiveKitConnection(locationId: BeingId) {
	const [room, setRoom] = useState<Room | null>(null);
	const [connectionState, setConnectionState] =
		useState<ConnectionState>("disconnected");
	const getJoinToken = api.livekit.getJoinToken.useMutation();

	// Store mutation in ref to avoid dependency issues
	const getJoinTokenRef = useRef(getJoinToken.mutateAsync);
	getJoinTokenRef.current = getJoinToken.mutateAsync;

	// Update state from shared connection
	const updateState = useCallback(() => {
		const connection = connectionMap.get(locationId);
		if (connection) {
			setRoom(connection.room);
			setConnectionState(connection.connectionState);
		}
	}, [locationId]);

	useEffect(() => {
		if (!locationId) {
			setConnectionState("disconnected");
			setRoom(null);
			return;
		}

		// Get or create connection entry
		let connection = connectionMap.get(locationId);
		if (!connection) {
			connection = {
				room: null,
				connectionState: "disconnected",
				subscribers: new Set(),
				connectionPromise: null,
			};
			connectionMap.set(locationId, connection);
		}

		// Subscribe to state changes
		connection.subscribers.add(updateState);

		// Update current state
		updateState();

		// Start connection if not already connecting/connected
		if (
			connection.connectionState === "disconnected" &&
			!connection.connectionPromise
		) {
			connection.connectionState = "connecting";

			const connect = async () => {
				try {
					const { token, wsUrl } = await getJoinTokenRef.current({
						roomBeingId: locationId,
					});

					const newRoom = new Room();
					connection!.room = newRoom;

					await newRoom.connect(wsUrl, token);

					connection!.connectionState = "connected";
				} catch (error) {
					connection!.connectionState = "failed";
					connection!.room = null;
					console.error("LiveKit connection failed:", error);
				} finally {
					connection!.connectionPromise = null;
					// Notify all subscribers
					connection!.subscribers.forEach((subscriber) => subscriber());
				}
			};

			connection.connectionPromise = connect();
		}

		return () => {
			const connection = connectionMap.get(locationId);
			if (connection) {
				connection.subscribers.delete(updateState);

				// If no more subscribers, disconnect after a delay
				if (connection.subscribers.size === 0) {
					setTimeout(() => {
						const conn = connectionMap.get(locationId);
						if (conn && conn.subscribers.size === 0) {
							if (conn.room) {
								conn.room.disconnect().catch(console.error);
							}
							connectionMap.delete(locationId);
						}
					}, 1000); // 1 second delay to allow for quick re-subscriptions
				}
			}
		};
	}, [locationId, updateState]);

	return {
		room,
		isConnected: connectionState === "connected",
		connectionState,
	};
}
