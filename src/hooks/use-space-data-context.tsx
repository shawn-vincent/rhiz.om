/**
 * Compatibility wrapper for the old space data context
 *
 * This is a minimal replacement that uses the new stream system.
 * Existing components can use this until they're updated to use the new hooks directly.
 */
"use client";

import { type ReactNode, createContext, useContext, useMemo } from "react";
import type { Being, Intention } from "~/server/db/types";
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
}

const SpaceDataContext = createContext<SpaceDataContextType>({
	beings: [],
	intentions: [],
	isConnected: false,
	connected: false,
	error: null,
	refresh: () => {},
	utterances: [],
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
		}),
		[beingsWithPresence, intentions, isConnected],
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
