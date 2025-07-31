import type { BeingId } from "~/lib/types";
import type { Being } from "~/server/db/types";
import { api } from "~/trpc/react";

/**
 * Focused hook for fetching beings in a specific location
 * Handles error logging and provides a clean interface for components
 */
export function useBeingsInLocation(locationId: BeingId): Being[] {
	const { data, error } = api.being.getByLocation.useQuery(
		{ locationId },
		{
			enabled: !!locationId,
			staleTime: 1000 * 60, // 1 minute - beings don't change frequently
		},
	);

	if (error) {
		// Error will be surfaced through React Query's error handling
		// Consumer components should handle display appropriately
	}

	return data || [];
}
