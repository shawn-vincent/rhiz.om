/**
 * Compatibility wrapper for the old space data context
 *
 * This is a minimal replacement that uses the new stream system.
 * Existing components can use this until they're updated to use the new hooks directly.
 */
"use client";

import { type ReactNode, createContext, useContext, useMemo } from "react";
import type { Being, Intention } from "~/server/db/types";
import { api } from "~/trpc/react";
import { useSpaceStream } from "./use-stream";

// Extended being type with presence info for compatibility
interface BeingWithPresence extends Being {
	isOnline: boolean;
}

interface SpaceDataContextType {
	beings: BeingWithPresence[];
	intentions: Intention[];
	isConnected: boolean;
	// Legacy compatibility
	connected: boolean;
	error: string | null;
	refresh: () => void;
	utterances: Intention[]; // Alias for intentions
	// Being cache functionality
	beingMap: Map<string, Being>;
	getBeing: (id: string) => Being | undefined;
}

const SpaceDataContext = createContext<SpaceDataContextType>({
	beings: [],
	intentions: [],
	isConnected: false,
	connected: false,
	error: null,
	refresh: () => {},
	utterances: [],
	beingMap: new Map(),
	getBeing: () => undefined,
});

interface SpaceDataProviderProps {
	children: ReactNode;
	spaceId: string;
}

export function SpaceDataProvider({
	children,
	spaceId,
}: SpaceDataProviderProps) {
	const { beings, intentions, isConnected } = useSpaceStream(spaceId);

	// Get all beings from global cache for comprehensive being lookup
	const rq = api.being.getAll.useQuery(undefined, {
		staleTime: 5 * 60 * 1000,
		enabled: typeof window !== "undefined",
	});

	// Create combined being cache (stream + global cache)
	const beingMap = useMemo(() => {
		const map = new Map<string, Being>();

		// Add global beings first
		if (rq.data) {
			for (const being of rq.data) {
				map.set(being.id, being);
			}
		}

		// Overlay stream beings (more up-to-date)
		if (beings) {
			for (const being of beings) {
				map.set(being.id, being);
			}
		}

		return map;
	}, [rq.data, beings]);

	const getBeing = useMemo(() => (id: string) => beingMap.get(id), [beingMap]);

	// Add consistent presence info for compatibility
	const beingsWithPresence = useMemo(
		() =>
			beings.map((being) => ({
				...being,
				isOnline: true, // All beings are "online" for now
			})),
		[beings],
	);

	const contextValue = useMemo(
		() => ({
			beings: beingsWithPresence,
			intentions,
			isConnected,
			connected: isConnected,
			error: null,
			refresh: () => {}, // No-op for now
			utterances: intentions, // Alias
			beingMap,
			getBeing,
		}),
		[beingsWithPresence, intentions, isConnected, beingMap, getBeing],
	);

	return (
		<SpaceDataContext.Provider value={contextValue}>
			{children}
		</SpaceDataContext.Provider>
	);
}

export function useSpaceDataContext() {
	return useContext(SpaceDataContext);
}
