import {
	type ReactNode,
	createContext,
	useContext,
	useDeferredValue,
	useMemo,
	useState,
} from "react";
import type { BeingType, EntitySummary } from "~/lib/space-types";
import type { BeingId } from "~/lib/types";
import type { Being } from "~/server/db/types";
import { api } from "~/trpc/react";
import { useRecents } from "./use-recents";

// Global being cache context to prevent multiple stream connections
interface BeingCacheContextType {
	beingMap: Map<BeingId, Being>;
	getBeing: (id: BeingId) => Being | undefined;
}

const BeingCacheContext = createContext<BeingCacheContextType | null>(null);

/**
 * Combined being management hook with caching, search, and recents
 */
export function useBeings(initialType?: BeingType, spaceId?: BeingId) {
	// Local state for search/filter
	const [query, setQuery] = useState("");
	const [type, setType] = useState<BeingType | undefined>(initialType);
	const qDeferred = useDeferredValue(query); // avoids instant refetch

	// No more stream beings - use tRPC only

	// Get all beings from global cache
	const rq = api.being.getAll.useQuery(void 0, {
		staleTime: 5 * 60 * 1000,
		enabled: typeof window !== "undefined",
	});

	// Create being cache from tRPC data only
	const beingMap = useMemo(() => {
		const map = new Map<BeingId, Being>();

		// Add all beings from tRPC
		if (rq.data) {
			for (const being of rq.data) {
				map.set(being.id, being);
			}
		}

		return map;
	}, [rq.data]);

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
	const getBeing = (id: BeingId): Being | undefined => beingMap.get(id);
	const getBeings = (ids: BeingId[]): (Being | undefined)[] =>
		ids.map((id) => beingMap.get(id));
	const hasBeing = (id: BeingId): boolean => beingMap.has(id);
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
 * Provider to share being cache across the app and prevent multiple stream connections
 */
export function BeingCacheProvider({
	children,
	spaceId,
}: { children: ReactNode; spaceId?: string }) {
	// This is the single source of truth for being data
	// No more stream beings - using tRPC only

	// Get all beings from global cache
	const rq = api.being.getAll.useQuery(void 0, {
		staleTime: 5 * 60 * 1000,
		enabled: typeof window !== "undefined",
	});

	// Create being cache from tRPC data only
	const beingMap = useMemo(() => {
		const map = new Map<BeingId, Being>();

		// Add all beings from tRPC
		if (rq.data) {
			for (const being of rq.data) {
				map.set(being.id, being);
			}
		}

		return map;
	}, [rq.data]);

	const getBeing = useMemo(() => (id: BeingId) => beingMap.get(id), [beingMap]);

	const contextValue = useMemo(
		() => ({
			beingMap,
			getBeing,
		}),
		[beingMap, getBeing],
	);

	return (
		<BeingCacheContext.Provider value={contextValue}>
			{children}
		</BeingCacheContext.Provider>
	);
}

/**
 * Hook for getting a single being with automatic fallback to server query
 */
export function useBeing(
	id: BeingId | undefined,
	options?: {
		enabled?: boolean;
	},
) {
	// Try to use BeingCacheContext first
	const beingCacheContext = useContext(BeingCacheContext);

	// Use BeingCacheContext, then fallback
	const getBeing = beingCacheContext?.getBeing;

	// Only create fallback if no context available (for backward compatibility)
	const fallback = !getBeing ? useBeings() : { getBeing: () => undefined };
	const finalGetBeing = getBeing || fallback.getBeing;

	const cachedBeing = id ? finalGetBeing(id) : undefined;

	const shouldFetchFromServer =
		options?.enabled !== false && !!id && id.length > 0 && !cachedBeing;

	// Only query server if not in cache
	const { data: serverBeing, error } = api.being.getById.useQuery(
		{ id: id! }, // id is guaranteed to be defined when shouldFetchFromServer is true
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
