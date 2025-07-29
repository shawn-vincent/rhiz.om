import { useCallback, useEffect, useRef, useState } from "react";
import { LiveKitSync } from "~/lib/sync/livekit-sync";
import { api } from "~/trpc/react";
import { useBeingsInLocation } from "./use-beings-in-location";
import { useIntentionsInLocation } from "./use-intentions-in-location";

// Singleton sync client instance
let syncClient: LiveKitSync | null = null;

export function useSync(spaceId: string) {
	const [isConnected, setIsConnected] = useState(false);

	// Use focused data hooks for cleaner separation of concerns
	const beings = useBeingsInLocation(spaceId);
	const intentions = useIntentionsInLocation(spaceId);

	// Get refetch functions from the existing data queries (avoiding duplication)
	const beingsQuery = api.being.getByLocation.useQuery({ locationId: spaceId }, { enabled: false });
	const intentionsQuery = api.intention.getAllUtterancesInBeing.useQuery({ beingId: spaceId }, { enabled: false });

	// tRPC mutation for getting join tokens
	const getJoinToken = api.livekit.getJoinToken.useMutation();

	// Store refetch functions in refs to avoid dependency issues
	const refetchBeingsRef = useRef(beingsQuery.refetch);
	const refetchIntentionsRef = useRef(intentionsQuery.refetch);

	// Update refs when functions change
	refetchBeingsRef.current = beingsQuery.refetch;
	refetchIntentionsRef.current = intentionsQuery.refetch;

	// Store the mutation in a ref to avoid recreating the token function
	const getJoinTokenRef = useRef(getJoinToken);
	getJoinTokenRef.current = getJoinToken;

	// Token function that can be used by the sync client
	const getTokenFn = useCallback(async (roomBeingId: string) => {
		return await getJoinTokenRef.current.mutateAsync({ roomBeingId });
	}, []); // No dependencies - stable function

	// Initialize sync client
	useEffect(() => {
		if (!syncClient) {
			syncClient = new LiveKitSync();
		}

		// Set the token function
		syncClient.setTokenFunction(getTokenFn);

		const handleSyncEvent = () => {
			refetchBeingsRef.current();
			refetchIntentionsRef.current();
		};

		const unsubscribe = syncClient.subscribe(handleSyncEvent);

		// Connect to space
		syncClient.connect(spaceId).then(() => {
			// Give the room a moment to fully connect
			setTimeout(() => setIsConnected(syncClient?.isConnected || false), 100);
		}).catch(() => {
			setIsConnected(false);
		});

		return () => {
			unsubscribe();
			setIsConnected(false);
		};
	}, [spaceId]); // getTokenFn is now stable, removed from dependencies

	return {
		beings,
		intentions,
		isConnected,
		room: syncClient?.room || null,
	};
}
