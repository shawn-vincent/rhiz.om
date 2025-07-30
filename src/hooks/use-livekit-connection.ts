import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import { api } from "~/trpc/react";

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

/**
 * Focused hook for managing LiveKit room connection
 * Eliminates singleton pattern and provides proper React lifecycle management
 */
export function useLiveKitConnection(locationId: string) {
	const [room, setRoom] = useState<Room | null>(null);
	const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
	const getJoinToken = api.livekit.getJoinToken.useMutation();
	
	// Store mutation in ref to avoid dependency issues
	const getJoinTokenRef = useRef(getJoinToken.mutateAsync);
	getJoinTokenRef.current = getJoinToken.mutateAsync;

	useEffect(() => {
		if (!locationId) {
			setConnectionState('disconnected');
			return;
		}

		let currentRoom: Room | null = null;
		let isMounted = true;

		const connect = async () => {
			if (!isMounted) return;
			
			try {
				setConnectionState('connecting');
				
				const { token, wsUrl } = await getJoinTokenRef.current({ 
					roomBeingId: locationId 
				});

				if (!isMounted) return;

				currentRoom = new Room();
				setRoom(currentRoom);

				await currentRoom.connect(wsUrl, token);

				if (!isMounted) {
					await currentRoom.disconnect();
					return;
				}

				setConnectionState('connected');
			} catch (error) {
				if (isMounted) {
					setConnectionState('failed');
					console.error('LiveKit connection failed:', error);
				}
			}
		};

		connect();

		return () => {
			isMounted = false;
			if (currentRoom) {
				currentRoom.disconnect().catch(console.error);
				setRoom(null);
			}
			setConnectionState('disconnected');
		};
	}, [locationId]); // Only depend on locationId

	return {
		room,
		isConnected: connectionState === 'connected',
		connectionState
	};
}