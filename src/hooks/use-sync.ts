import { useEffect } from "react";
import { api } from "~/trpc/react";

export function useSync(spaceId: string) {
	// Get initial data and refetch capability
	const { data: beings, refetch: refetchBeings } =
		api.being.getByLocation.useQuery({ locationId: spaceId });
	const { data: intentions, refetch: refetchIntentions } =
		api.intention.getAllUtterancesInBeing.useQuery({ beingId: spaceId });

	// Listen for sync events and refetch
	useEffect(() => {
		const handleSync = () => {
			refetchBeings();
			refetchIntentions();
		};
		window.addEventListener("sync-change", handleSync);
		return () => window.removeEventListener("sync-change", handleSync);
	}, [refetchBeings, refetchIntentions]);

	return {
		beings: beings || [],
		intentions: intentions || [],
		isConnected: true,
	};
}
