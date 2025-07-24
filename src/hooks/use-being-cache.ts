import { useParams } from "next/navigation";
import { useMemo } from "react";
import { api } from "~/trpc/react";
import type { Being, BeingId } from "~/server/db/types";
import { useSpacePresence } from "./use-state-sync";

/**
 * A client-side being cache that:
 * 1. First checks the sync store for beings in the current space
 * 2. Falls back to being.getAll for global beings
 * 3. Only makes individual being.getById queries as a last resort
 */
export function useBeingCache() {
	const params = useParams();
	const currentSpaceId = params?.beingId 
		? decodeURIComponent(params.beingId as string) as BeingId
		: undefined;

	// Get beings from the sync store (current space)
	const { presence } = useSpacePresence(currentSpaceId ?? "" as BeingId);
	const syncBeings = presence?.beings.map(b => b.being) ?? [];

	// Get all beings from the global cache (fallback)
	const { data: allBeings } = api.being.getAll.useQuery(undefined, {
		staleTime: 5 * 60 * 1000, // Cache for 5 minutes
		// Disable during SSR to prevent hydration mismatches
		enabled: typeof window !== "undefined",
	});

	// Create a combined being map
	const beingMap = useMemo(() => {
		const map = new Map<string, Being>();
		
		// First add all beings from global cache
		if (allBeings) {
			for (const being of allBeings) {
				map.set(being.id, being);
			}
		}
		
		// Then overlay beings from sync store (more up-to-date)
		for (const being of syncBeings) {
			map.set(being.id, being);
		}
		
		return map;
	}, [allBeings, syncBeings]);

	return {
		/**
		 * Get a being by ID from the cache. Returns undefined if not found.
		 * This should be used instead of being.getById.useQuery in most cases.
		 */
		getBeing: (id: string): Being | undefined => {
			return beingMap.get(id);
		},

		/**
		 * Get multiple beings by IDs from the cache.
		 */
		getBeings: (ids: string[]): (Being | undefined)[] => {
			return ids.map(id => beingMap.get(id));
		},

		/**
		 * Check if a being exists in the cache.
		 */
		hasBeing: (id: string): boolean => {
			return beingMap.has(id);
		},

		/**
		 * Get all beings currently in the cache.
		 */
		getAllBeings: (): Being[] => {
			return Array.from(beingMap.values());
		},

		/**
		 * Get the size of the cache (number of beings).
		 */
		cacheSize: beingMap.size,
	};
}

/**
 * Hook for getting a single being with automatic fallback to server query.
 * Use this as a drop-in replacement for api.being.getById.useQuery.
 */
export function useBeing(id: string | undefined, options?: {
	enabled?: boolean;
}) {
	const { getBeing } = useBeingCache();
	const cachedBeing = id ? getBeing(id) : undefined;
	
	const shouldFetchFromServer = 
		options?.enabled !== false && 
		!!id && 
		id.length > 0 && 
		!cachedBeing;

	// Only query server if not in cache and we're on the client
	const { data: serverBeing, error } = api.being.getById.useQuery(
		{ id: id ?? "" },
		{
			enabled: shouldFetchFromServer && typeof window !== "undefined",
			retry: false,
			staleTime: 5 * 60 * 1000,
		}
	);

	return {
		data: cachedBeing || serverBeing,
		error: !cachedBeing ? error : undefined,
		isLoading: shouldFetchFromServer && !serverBeing && !error,
		isFromCache: !!cachedBeing,
		isFromServer: !!serverBeing && !cachedBeing,
	};
}