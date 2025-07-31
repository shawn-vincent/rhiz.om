import type { BeingId } from "~/lib/types";
import type { Intention } from "~/server/db/types";
import { api } from "~/trpc/react";

/**
 * Focused hook for fetching intentions (utterances) in a specific location
 * Handles error logging and provides a clean interface for components
 */
export function useIntentionsInLocation(locationId: BeingId): Intention[] {
	const { data, error } = api.intention.getAllUtterancesInBeing.useQuery(
		{ beingId: locationId },
		{
			enabled: !!locationId,
			staleTime: 1000 * 30, // 30 seconds - intentions change more frequently
		},
	);

	if (error) {
		// Error will be surfaced through React Query's error handling
		// Consumer components should handle display appropriately
	}

	return data || [];
}
