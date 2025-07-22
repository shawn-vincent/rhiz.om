import { useCallback, useEffect, useRef, useState } from "react";
import { StateSyncClient } from "~/lib/state-sync-client";
import type {
	SpaceIntentions,
	SpacePresence,
	SyncError,
	VersionedState,
} from "~/lib/state-sync-types";
import type { BeingId } from "~/server/db/types";

// Generic hook for state synchronization
function useStateSync<T>(model: string, spaceId: BeingId) {
	const [data, setData] = useState<T | null>(null);
	const [version, setVersion] = useState(0);
	const [error, setError] = useState<SyncError | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const clientRef = useRef<StateSyncClient<T> | null>(null);

	const handleStateUpdate = useCallback((versionedState: VersionedState<T>) => {
		setData(versionedState.data);
		setVersion(versionedState.version);
		setError(null); // Clear any previous errors
	}, []);

	const handleError = useCallback((syncError: SyncError) => {
		setError(syncError);
		setIsConnected(false);
	}, []);

	useEffect(() => {
		if (!spaceId) return;

		// Create and connect client
		const client = new StateSyncClient<T>();
		clientRef.current = client;

		client.setStateUpdateHandler(handleStateUpdate);
		client.setErrorHandler(handleError);

		client.connect(model, spaceId);

		// Check connection status periodically
		const statusCheck = setInterval(() => {
			setIsConnected(client.isConnectionActive());
		}, 1000);

		// Cleanup
		return () => {
			clearInterval(statusCheck);
			client.disconnect();
			clientRef.current = null;
		};
	}, [model, spaceId, handleStateUpdate, handleError]);

	const retry = useCallback(() => {
		if (clientRef.current && spaceId) {
			setError(null);
			clientRef.current.disconnect();
			clientRef.current.connect(model, spaceId);
		}
	}, [model, spaceId]);

	return {
		data,
		version,
		error,
		isConnected,
		retry,
	};
}

// Specific hooks for different models
export function useSpacePresence(spaceId: BeingId) {
	const {
		data: presence,
		version,
		error,
		isConnected,
		retry,
	} = useStateSync<SpacePresence>("presence", spaceId);

	// Derived state for UI convenience
	const onlineBeings =
		presence?.beings.filter((b) => b.connectionStatus === "online") ?? [];
	const offlineBeings =
		presence?.beings.filter((b) => b.connectionStatus === "offline") ?? [];
	const awayBeings =
		presence?.beings.filter((b) => b.connectionStatus === "away") ?? [];

	return {
		presence,
		version,
		error,
		isConnected,
		retry,
		// Convenience accessors
		onlineBeings,
		offlineBeings,
		awayBeings,
		totalBeings: presence?.beings.length ?? 0,
	};
}

export function useSpaceIntentions(spaceId: BeingId) {
	const {
		data: intentionsData,
		version,
		error,
		isConnected,
		retry,
	} = useStateSync<SpaceIntentions>("intentions", spaceId);

	// Return just the intentions array for easier consumption
	const intentions = intentionsData?.intentions ?? [];

	// Derived state
	const utterances = intentions.filter((i) => i.type === "utterance");
	const errors = intentions.filter((i) => i.type === "error");
	const activeIntentions = intentions.filter((i) => i.state === "active");
	const completedIntentions = intentions.filter((i) => i.state === "complete");

	return {
		intentions,
		intentionsData, // Full data object if needed
		version,
		error,
		isConnected,
		retry,
		// Convenience accessors
		utterances,
		errors,
		activeIntentions,
		completedIntentions,
		totalIntentions: intentions.length,
	};
}

// Hook for migration from existing tRPC queries
export function useSpacePresenceWithFallback(
	spaceId: BeingId,
	fallbackEnabled = true,
) {
	const sync = useSpacePresence(spaceId);

	// TODO: Add fallback to existing tRPC query if sync fails
	// This allows gradual migration

	return sync;
}

export function useSpaceIntentionsWithFallback(
	spaceId: BeingId,
	fallbackEnabled = true,
) {
	const sync = useSpaceIntentions(spaceId);

	// TODO: Add fallback to existing tRPC query if sync fails
	// This allows gradual migration

	return sync;
}
