import { useDeferredValue, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { useRecents } from "./use-recents";
import { useSpaceDataContext } from "./use-space-data-context";
import type { Being } from "~/server/db/types";
import type { BeingType, EntitySummary } from "~/lib/space-types";

/**
 * Combined being management hook with caching, search, and recents
 */
export function useBeings(initialType?: BeingType) {
	// Local state for search/filter
	const [query, setQuery] = useState("");
	const [type, setType] = useState<BeingType | undefined>(initialType);
	const qDeferred = useDeferredValue(query); // avoids instant refetch

	// Get beings from sync store (current space)
	const { beings: syncBeings } = useSpaceDataContext();

	// Get all beings from global cache
	const rq = api.being.getAll.useQuery(undefined, {
		staleTime: 5 * 60 * 1000,
		enabled: typeof window !== "undefined",
	});

	// Create combined being cache
	const beingMap = useMemo(() => {
		const map = new Map<string, Being>();

		// Add global beings first
		if (rq.data) {
			for (const being of rq.data) {
				map.set(being.id, being);
			}
		}

		// Overlay sync beings (more up-to-date)
		if (syncBeings) {
			for (const being of syncBeings) {
				map.set(being.id, being);
			}
		}

		return map;
	}, [rq.data, syncBeings]);

	// Filter and search items
	const items = useMemo(() => {
		const allBeings = Array.from(beingMap.values());
		return allBeings
			.filter((being) => {
				const matchesQuery = being.name
					.toLowerCase()
					.includes(qDeferred.toLowerCase());
				const matchesType = !type || (being.type as BeingType) === type;
				return matchesQuery && matchesType;
			})
			.map(
				(being) =>
					({
						...being,
						type: being.type as BeingType,
					}) as EntitySummary,
			);
	}, [beingMap, qDeferred, type]);

	const { recents, addRecent } = useRecents<EntitySummary>("beings", 20);

	// Cache access functions
	const getBeing = (id: string): Being | undefined => beingMap.get(id);
	const getBeings = (ids: string[]): (Being | undefined)[] => 
		ids.map((id) => beingMap.get(id));
	const hasBeing = (id: string): boolean => beingMap.has(id);
	const getAllBeings = (): Being[] => Array.from(beingMap.values());

	return { 
		// Search/filter interface
		query, 
		setQuery, 
		type, 
		setType, 
		...rq, 
		items, 
		recents, 
		addRecent,
		// Cache interface
		getBeing,
		getBeings,
		hasBeing,
		getAllBeings,
		cacheSize: beingMap.size,
	};
}

/**
 * Hook for getting a single being with automatic fallback to server query
 */
export function useBeing(
	id: string | undefined,
	options?: {
		enabled?: boolean;
	},
) {
	const { getBeing } = useBeings();
	const cachedBeing = id ? getBeing(id) : undefined;

	const shouldFetchFromServer =
		options?.enabled !== false && !!id && id.length > 0 && !cachedBeing;

	// Only query server if not in cache
	const { data: serverBeing, error } = api.being.getById.useQuery(
		{ id: id ?? "" },
		{
			enabled: shouldFetchFromServer && typeof window !== "undefined",
			retry: false,
			staleTime: 5 * 60 * 1000,
		},
	);

	return {
		data: cachedBeing || serverBeing,
		error: !cachedBeing ? error : undefined,
		isLoading: shouldFetchFromServer && !serverBeing && !error,
		isFromCache: !!cachedBeing,
		isFromServer: !!serverBeing && !cachedBeing,
	};
}
