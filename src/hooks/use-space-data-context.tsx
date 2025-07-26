"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSpaceData } from "./use-simple-sync";
import type { BeingId } from "~/server/db/types";

interface SpaceDataContextType {
	data: ReturnType<typeof useSpaceData>;
}

const SpaceDataContext = createContext<SpaceDataContextType | null>(null);

interface SpaceDataProviderProps {
	children: ReactNode;
	spaceId: BeingId;
}

export function SpaceDataProvider({ children, spaceId }: SpaceDataProviderProps) {
	const spaceData = useSpaceData(spaceId);

	return (
		<SpaceDataContext.Provider value={{ data: spaceData }}>
			{children}
		</SpaceDataContext.Provider>
	);
}

export function useSpaceDataContext() {
	const context = useContext(SpaceDataContext);
	if (!context) {
		throw new Error("useSpaceDataContext must be used within a SpaceDataProvider");
	}
	return context.data;
}