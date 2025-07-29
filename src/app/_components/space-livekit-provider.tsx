"use client";

import { useCallback } from "react";
import { LiveKitProvider } from "~/contexts/livekit-context";
import { useSpaceLiveKit } from "~/hooks/useSpaceLiveKit";

interface SpaceLiveKitProviderProps {
	spaceBeingId: string;
	children: React.ReactNode;
}

export function SpaceLiveKitProvider({
	spaceBeingId,
	children,
}: SpaceLiveKitProviderProps) {
	// Auto-connect to LiveKit when this component mounts
	const livekit = useSpaceLiveKit({
		spaceBeingId,
		autoConnect: true,
	});

	const contextValue = {
		isConnected: livekit.isConnected,
		isConnecting: livekit.isConnecting,
		currentRoomId: spaceBeingId,
	};

	return <LiveKitProvider value={contextValue}>{children}</LiveKitProvider>;
}
