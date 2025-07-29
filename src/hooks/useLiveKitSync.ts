"use client";

import { type RemoteParticipant, Room, RoomEvent } from "livekit-client";
import { useCallback, useRef, useState } from "react";
import { logger } from "~/lib/logger.client";
import { toast } from "~/lib/toast";
import { api } from "~/trpc/react";

const livekitLogger = logger.child({ name: "LiveKit" });

export function useLiveKitSync() {
	const roomRef = useRef<Room | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);

	const getJoinToken = api.livekit.getJoinToken.useMutation();

	const connect = useCallback(
		async (roomBeingId: string) => {
			if (isConnecting || isConnected) return;

			setIsConnecting(true);

			try {
				// Get join token from our tRPC endpoint
				const { token, wsUrl } = await getJoinToken.mutateAsync({
					roomBeingId,
				});

				// Create and connect to LiveKit room
				const room = new Room();

				// Set up event listeners
				room.on(RoomEvent.Connected, () => {
					livekitLogger.info({ roomBeingId }, "Connected to room");
					setIsConnected(true);
				});

				room.on(RoomEvent.Disconnected, () => {
					livekitLogger.info("Disconnected from room");
					setIsConnected(false);
				});

				room.on(
					RoomEvent.DataReceived,
					(
						payload: Uint8Array,
						participant?: RemoteParticipant,
						kind?: any,
						topic?: string,
					) => {
						try {
							const text = new TextDecoder().decode(payload);

							if (topic === "sync") {
								const syncEvent = JSON.parse(text);
								// Trigger refetch for any sync event
								window.dispatchEvent(
									new CustomEvent("sync-change", { detail: syncEvent }),
								);
							}
						} catch (error) {
							console.error("Error parsing sync event:", error);
						}
					},
				);

				// Connect to LiveKit
				await room.connect(wsUrl, token);
				roomRef.current = room;
			} catch (error) {
				console.error("Failed to connect to LiveKit room:", error);
				setIsConnected(false);
				toast.error("Failed to connect to LiveKit room");
			} finally {
				setIsConnecting(false);
			}
		},
		[getJoinToken, isConnecting, isConnected],
	);

	const disconnect = useCallback(async () => {
		if (roomRef.current) {
			await roomRef.current.disconnect();
			roomRef.current = null;
		}
		setIsConnected(false);
	}, []);

	return {
		connect,
		disconnect,
		isConnected,
		isConnecting,
		room: roomRef.current,
	};
}
