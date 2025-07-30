import { useEffect, useRef } from "react";
import { RoomEvent, type RemoteParticipant } from "livekit-client";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/trpc/react";
import { useBeingsInLocation } from "./use-beings-in-location";
import { useIntentionsInLocation } from "./use-intentions-in-location";
import { useLiveKitConnection } from "./use-livekit-connection";
import type { SyncEvent } from "~/lib/sync";

export function useSync(spaceId: string) {
	// Use focused data hooks for cleaner separation of concerns
	const beings = useBeingsInLocation(spaceId);
	const intentions = useIntentionsInLocation(spaceId);

	// Use focused connection hook (eliminates singleton pattern)
	const { room, isConnected } = useLiveKitConnection(spaceId);

	// Use query client for efficient invalidation
	const queryClient = useQueryClient();

	// Handle sync events from LiveKit room
	useEffect(() => {
		if (!room) return;

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
							queryKey: [['being', 'getByLocation'], { input: { locationId: spaceId } }]
						});
						break;
					case 'intention-created':
					case 'intention-updated':
						queryClient.invalidateQueries({
							queryKey: [['intention', 'getAllUtterancesInBeing'], { input: { beingId: spaceId } }]
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
	}, [room, spaceId, queryClient]);

	return {
		beings,
		intentions,
		isConnected,
		room,
	};
}
