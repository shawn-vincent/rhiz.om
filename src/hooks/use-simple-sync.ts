import { useCallback, useEffect, useRef, useState } from "react";
import type {
	BeingRequest,
	BeingResponse,
	ConnectionState,
	IntentionRequest,
	IntentionResponse,
	SpaceData,
} from "~/lib/simple-sync-types";
import type { Being, BeingId, Intention } from "~/server/db/types";

// Global cache - simple Map storage
const globalBeingCache = new Map<string, Being>();
const globalIntentionCache = new Map<string, Intention>();

// Global connection management to prevent multiple connections per space
const activeConnections = new Map<string, EventSource>();

// Update global cache when space data changes
function updateGlobalCache(spaceData: SpaceData) {
	spaceData.beings.forEach((being) => globalBeingCache.set(being.id, being));
	spaceData.intentions.forEach((intention) =>
		globalIntentionCache.set(intention.id, intention),
	);
}

// Main hook for space data with real-time sync
export function useSpaceData(spaceId: BeingId) {
	const [data, setData] = useState<SpaceData | null>(null);
	const [connectionState, setConnectionState] =
		useState<ConnectionState>("disconnected");
	const [error, setError] = useState<string | null>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

	// Cleanup function
	const cleanup = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}
		if (pollingIntervalRef.current) {
			clearInterval(pollingIntervalRef.current);
			pollingIntervalRef.current = null;
		}
		// Remove from global tracking
		if (activeConnections.get(spaceId) === eventSourceRef.current) {
			activeConnections.delete(spaceId);
		}
	}, [spaceId]);

	// Polling fallback
	const startPolling = useCallback(async () => {
		if (pollingIntervalRef.current) return; // Already polling

		const poll = async () => {
			try {
				const response = await fetch(
					`/api/sync?spaceId=${encodeURIComponent(spaceId)}`,
				);
				if (response.ok) {
					const reader = response.body?.getReader();
					const decoder = new TextDecoder();

					if (reader) {
						const { value } = await reader.read();
						const chunk = decoder.decode(value);
						const lines = chunk.split("\n");

						for (const line of lines) {
							if (line.startsWith("data: ")) {
								const jsonData = line.slice(6);
								const spaceData: SpaceData = JSON.parse(jsonData);
								setData(spaceData);
								updateGlobalCache(spaceData);
								setError(null);
								// Try to upgrade back to real-time
								startRealTime();
								return;
							}
						}
					}
				}
			} catch (err) {
				console.error("Polling failed:", err);
				setError("Connection lost");
			}
		};

		// Poll immediately, then every 5 seconds
		poll();
		pollingIntervalRef.current = setInterval(poll, 5000);
	}, [spaceId]);

	// Real-time SSE connection
	const startRealTime = useCallback(() => {
		// Check if there's already an active connection for this space
		const existingConnection = activeConnections.get(spaceId);
		if (existingConnection && existingConnection.readyState === EventSource.OPEN) {
			return;
		}

		cleanup(); // Clean up any existing connections

		if (!spaceId) return;

		setConnectionState("connecting");

		try {
			const eventSource = new EventSource(
				`/api/sync?spaceId=${encodeURIComponent(spaceId)}&types=beings,intentions`,
			);
			eventSourceRef.current = eventSource;
			activeConnections.set(spaceId, eventSource);

			eventSource.onopen = () => {
				setConnectionState("connected");
				setError(null);
			};

			eventSource.onmessage = (event) => {
				try {
					const spaceData: SpaceData = JSON.parse(event.data);
					setData(spaceData);
					updateGlobalCache(spaceData);
					setError(null);
				} catch (err) {
					console.error("Error parsing SSE message:", err);
					setError("Invalid data received");
				}
			};

			eventSource.onerror = (event) => {
				console.error(`EventSource error for ${spaceId}:`, event);
				setConnectionState("error");
				setError("Connection failed");

				// Clean up failed connection
				activeConnections.delete(spaceId);

				// Fall back to polling after a short delay
				reconnectTimeoutRef.current = setTimeout(() => {
					startPolling();
				}, 1000);
			};
		} catch (err) {
			console.error(`Failed to create EventSource for ${spaceId}:`, err);
			setConnectionState("error");
			setError("Failed to establish connection");
			startPolling();
		}
	}, [spaceId, cleanup, startPolling]);

	// Manual refresh function
	const refresh = useCallback(() => {
		startRealTime();
	}, [startRealTime]);

	// Initialize connection
	useEffect(() => {
		startRealTime();
		return cleanup;
	}, [startRealTime, cleanup]);

	// Derived data for convenience
	const beings = data?.beings ?? [];
	const intentions = data?.intentions ?? [];
	const onlineBeings = beings.filter(
		(being) =>
			being.type === "space" || being.type === "bot" || being.type === "guest",
	);
	const utterances = intentions.filter(
		(intention) => intention.type === "utterance",
	);

	return {
		// Core data
		data,
		beings,
		intentions,

		// Connection state
		connected: connectionState === "connected",
		connectionState,
		error,

		// Derived data
		onlineBeings,
		utterances,
		version: data?.version ?? 0,

		// Actions
		refresh,
	};
}

// Simple API helpers
export async function callBeingAPI(
	request: BeingRequest,
): Promise<BeingResponse> {
	const response = await fetch("/api/beings", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});

	if (!response.ok) {
		throw new Error(`API call failed: ${response.statusText}`);
	}

	return response.json();
}

export async function callIntentionAPI(
	request: IntentionRequest,
): Promise<IntentionResponse> {
	const response = await fetch("/api/intentions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});

	if (!response.ok) {
		throw new Error(`API call failed: ${response.statusText}`);
	}

	return response.json();
}

// Cache lookup helpers
export function getCachedBeing(id: string): Being | undefined {
	return globalBeingCache.get(id);
}

export function getCachedIntention(id: string): Intention | undefined {
	return globalIntentionCache.get(id);
}
