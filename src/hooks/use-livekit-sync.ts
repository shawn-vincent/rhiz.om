import { useEffect } from "react";
import { RoomEvent, type RemoteParticipant, type Room } from "livekit-client";
import { useQueryClient } from "@tanstack/react-query";
import type { SyncEvent } from "~/lib/sync";

/**
 * Focused hook for coordinating sync events with data invalidation
 * Handles the mapping between LiveKit sync events and tRPC query invalidation
 */
export function useLiveKitSync(locationId: string, room: Room | null): void {
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!room || !locationId) return;

		const handleDataReceived = (
			payload: Uint8Array,
			participant?: RemoteParticipant,
			kind?: any,
			topic?: string,
		) => {
			if (topic !== "sync") return;

			try {
				const text = new TextDecoder().decode(payload);
				const event = JSON.parse(text) as SyncEvent;
				
				// Invalidate queries based on event type for efficient updates
				switch (event.type) {
					case 'being-created':
					case 'being-updated':
						queryClient.invalidateQueries({
							queryKey: [['being', 'getByLocation'], { input: { locationId } }]
						});
						break;
					case 'intention-created':
					case 'intention-updated':
						queryClient.invalidateQueries({
							queryKey: [['intention', 'getAllUtterancesInBeing'], { input: { beingId: locationId } }]
						});
						break;
				}
			} catch (error) {
				console.error("Error parsing sync event:", error);
			}
		};

		room.on(RoomEvent.DataReceived, handleDataReceived);

		return () => {
			room.off(RoomEvent.DataReceived, handleDataReceived);
		};
	}, [room, locationId, queryClient]);
}