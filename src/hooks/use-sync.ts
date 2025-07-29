import { useCallback, useEffect, useRef, useState } from "react";
import { LiveKitSync } from "~/lib/sync/livekit-sync";
import { api } from "~/trpc/react";

// Singleton sync client instance
let syncClient: LiveKitSync | null = null;

export function useSync(spaceId: string) {
	const [isConnected, setIsConnected] = useState(false);

	// Get initial data and refetch capability
	const { data: beings, refetch: refetchBeings } =
		api.being.getByLocation.useQuery({ locationId: spaceId });
	const { data: intentions, refetch: refetchIntentions } =
		api.intention.getAllUtterancesInBeing.useQuery({ beingId: spaceId });

	// tRPC mutation for getting join tokens
	const getJoinToken = api.livekit.getJoinToken.useMutation();

	// Store refetch functions in refs to avoid dependency issues
	const refetchBeingsRef = useRef(refetchBeings);
	const refetchIntentionsRef = useRef(refetchIntentions);

	// Update refs when functions change
	refetchBeingsRef.current = refetchBeings;
	refetchIntentionsRef.current = refetchIntentions;

	// Token function that can be used by the sync client
	const getTokenFn = useCallback(async (roomBeingId: string) => {
		return await getJoinToken.mutateAsync({ roomBeingId });
	}, [getJoinToken]);

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
			setIsConnected(syncClient?.isConnected || false);
		}).catch(() => {
			setIsConnected(false);
		});

		return () => {
			unsubscribe();
			setIsConnected(false);
		};
	}, [spaceId, getTokenFn]);

	return {
		beings: beings || [],
		intentions: intentions || [],
		isConnected,
	};
}
