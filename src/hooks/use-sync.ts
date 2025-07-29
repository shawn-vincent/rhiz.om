import { useEffect, useRef } from "react";
import { api } from "~/trpc/react";

export function useSync(spaceId: string) {
	// Get initial data and refetch capability
	const { data: beings, refetch: refetchBeings } =
		api.being.getByLocation.useQuery({ locationId: spaceId });
	const { data: intentions, refetch: refetchIntentions } =
		api.intention.getAllUtterancesInBeing.useQuery({ beingId: spaceId });

	// Store refetch functions in refs to avoid dependency issues
	const refetchBeingsRef = useRef(refetchBeings);
	const refetchIntentionsRef = useRef(refetchIntentions);

	// Update refs when functions change
	refetchBeingsRef.current = refetchBeings;
	refetchIntentionsRef.current = refetchIntentions;

	// Listen for sync events and refetch
	useEffect(() => {
		const handleSync = () => {
			refetchBeingsRef.current();
			refetchIntentionsRef.current();
		};

		window.addEventListener("sync-change", handleSync);
		return () => window.removeEventListener("sync-change", handleSync);
	}, []); // Empty dependency array - no re-registering!

	return {
		beings: beings || [],
		intentions: intentions || [],
		isConnected: true,
	};
}
