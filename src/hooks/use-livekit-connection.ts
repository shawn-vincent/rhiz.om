import type { BeingId } from "~/lib/types";
import { useSharedLiveKitConnection } from "./use-shared-livekit-connection";

export type { ConnectionState } from "./use-shared-livekit-connection";

/**
 * Focused hook for managing LiveKit room connection
 * Uses shared connection to prevent multiple connections to the same room
 */
export function useLiveKitConnection(locationId: BeingId) {
	return useSharedLiveKitConnection(locationId);
}
