import type { BeingId } from "~/lib/types";
import { useBeingsInLocation } from "./use-beings-in-location";
import { useIntentionsInLocation } from "./use-intentions-in-location";
import { useLiveKitConnection } from "./use-livekit-connection";
import { useLiveKitSync } from "./use-livekit-sync";

export function useSync(spaceId: BeingId) {
	// Use focused data hooks for cleaner separation of concerns
	const beings = useBeingsInLocation(spaceId);
	const intentions = useIntentionsInLocation(spaceId);

	// Use focused connection hook (eliminates singleton pattern)
	const { room, isConnected } = useLiveKitConnection(spaceId);

	// Use focused sync coordination hook
	useLiveKitSync(spaceId, room);

	return {
		beings,
		intentions,
		isConnected,
		room,
	};
}
