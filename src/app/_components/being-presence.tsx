// src/app/_components/being-presence.tsx
"use client";

import type { BeingType } from "packages/entity-kit/src/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "~/components/ui/avatar";
import { api } from "~/trpc/react";

interface BeingPresenceData {
	id: string;
	name: string;
	type: BeingType;
	isOnline: boolean;
}

interface PresenceEvent {
	type: "connected" | "heartbeat" | "presence_change" | "location_change";
	connectionId?: string;
	heartbeatInterval?: number;
	beingId?: string;
	isOnline?: boolean;
	locationId?: string | null;
}

interface BeingPresenceProps {
	compact?: boolean;
	currentSpaceId?: string; // The space/location we're showing presence for
}

export function BeingPresence({ compact = false, currentSpaceId }: BeingPresenceProps) {
	const [beings, setBeings] = useState<BeingPresenceData[]>([]);
	const [connectionState, setConnectionState] = useState<
		"connecting" | "connected" | "disconnected"
	>("disconnected");
	const connectionRef = useRef<{
		eventSource: EventSource | null;
		connectionId: string | null;
		reconnectAttempts: number;
		heartbeatInterval: number | null;
	}>({
		eventSource: null,
		connectionId: null,
		reconnectAttempts: 0,
		heartbeatInterval: null,
	});

	// Fetch presence data for current location
	const { data: allBeings, error: presenceError, isLoading } = api.presence.getByLocation.useQuery(
		{ locationId: currentSpaceId },
		{ enabled: !!currentSpaceId } // Only run query if we have a space ID
	);


	// Exponential backoff for reconnection
	const getReconnectDelay = (attempts: number) => {
		return Math.min(1000 * Math.pow(2, attempts), 30000); // Max 30 seconds
	};

	// Send heartbeat response to server
	const sendHeartbeatResponse = async (connectionId: string) => {
		try {
			await fetch("/api/presence/events", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ connectionId }),
			});
		} catch (error) {
			console.warn("Failed to send heartbeat response:", error);
		}
	};

	// Setup SSE connection with reconnection logic
	const setupConnection = useCallback(() => {
		const ref = connectionRef.current;

		if (
			ref.eventSource?.readyState === EventSource.CONNECTING ||
			ref.eventSource?.readyState === EventSource.OPEN
		) {
			return;
		}

		setConnectionState("connecting");
		
		// Safari-specific EventSource configuration
		const eventSourceConfig = {
			withCredentials: true
		};
		
		const eventSource = new EventSource("/api/presence/events", eventSourceConfig);
		ref.eventSource = eventSource;

		eventSource.onopen = () => {
			setConnectionState("connected");
			ref.reconnectAttempts = 0;
		};

		eventSource.onmessage = (event) => {
			try {
				const data: PresenceEvent = JSON.parse(event.data);

				if (data.type === "connected") {
					ref.connectionId = data.connectionId || null;
					if (data.heartbeatInterval && ref.connectionId) {
						// Set up client-side heartbeat response
						if (ref.heartbeatInterval) clearInterval(ref.heartbeatInterval);
						ref.heartbeatInterval = window.setInterval(() => {
							if (ref.connectionId) {
								sendHeartbeatResponse(ref.connectionId);
							}
						}, data.heartbeatInterval);
					}
				} else if (data.type === "heartbeat") {
					// Server heartbeat - respond to keep connection alive
					if (ref.connectionId) {
						sendHeartbeatResponse(ref.connectionId);
					}
				} else if (data.type === "presence_change" && data.beingId) {
					setBeings((prev) =>
						prev.map((b) =>
							b.id === data.beingId
								? { ...b, isOnline: data.isOnline ?? b.isOnline }
								: b,
						),
					);
				} else if (data.type === "location_change" && data.beingId) {
					// Location changes don't affect online status directly
					// Could add location-based presence logic here
				}
			} catch (error) {
				console.error("Failed to parse SSE event:", error);
			}
		};

		eventSource.onerror = () => {
			setConnectionState("disconnected");
			ref.eventSource?.close();

			// Cleanup
			if (ref.heartbeatInterval) {
				clearInterval(ref.heartbeatInterval);
				ref.heartbeatInterval = null;
			}
			ref.connectionId = null;

			// Reconnect with exponential backoff
			const delay = getReconnectDelay(ref.reconnectAttempts);
			ref.reconnectAttempts++;

			setTimeout(() => {
				setupConnection();
			}, delay);
		};

		return eventSource;
	}, []);

	// Set up connection on mount
	useEffect(() => {
		const eventSource = setupConnection();

		return () => {
			const ref = connectionRef.current;
			ref.eventSource?.close();
			if (ref.heartbeatInterval) {
				clearInterval(ref.heartbeatInterval);
			}
		};
	}, [setupConnection]);

	// Initialize beings from API data with proper online status
	useEffect(() => {
		if (allBeings) {
			setBeings(
				allBeings.map((being) => ({
					id: being.id,
					name: being.name,
					type: being.type as BeingType,
					isOnline: being.isOnline,
				})),
			);
		} else if (!isLoading && !presenceError && currentSpaceId) {
			// If query completed but returned no data, set empty array
			console.warn("Presence query returned no data for space:", currentSpaceId);
			setBeings([]);
		}
	}, [allBeings, isLoading, presenceError, currentSpaceId]);

	// Separate beings by type and connection status
	const connectedGuests = beings.filter((being) => being.type === "guest" && being.isOnline);
	const disconnectedGuests = beings.filter((being) => being.type === "guest" && !being.isOnline);
	const spacesAndBots = beings.filter((being) => being.type === "space" || being.type === "bot");

	// Compact mode for mobile/narrow screens
	if (compact) {
		const allVisibleBeings = [...spacesAndBots, ...connectedGuests, ...disconnectedGuests];
		const firstBeing = allVisibleBeings[0];
		const totalConnected = spacesAndBots.length + connectedGuests.length;
		const hasMultiple = allVisibleBeings.length > 1;

		if (!firstBeing) return null;

		return (
			<div className="relative flex items-center">
				<div className="relative">
					<Avatar
						beingId={firstBeing.id}
						beingType={firstBeing.type}
						size="sm"
						className={`ring-2 ${
							firstBeing.isOnline 
								? "ring-green-400/50" 
								: "ring-gray-400/50 opacity-60"
						}`}
					/>
					{/* Online/offline indicator */}
					<div className={`-bottom-0.5 -right-0.5 absolute h-3 w-3 rounded-full border-2 border-black ${
						firstBeing.isOnline ? "bg-green-400" : "bg-gray-500"
					}`} />

					{/* Stack indicator for multiple beings */}
					{hasMultiple && (
						<>
							{/* Shadow avatar behind */}
							<div className="-top-1 -right-1 -z-10 absolute h-8 w-8 rounded-full bg-gray-600/50 ring-1 ring-green-400/30" />
							{/* Count badge - show total connected */}
							<div className="-top-2 -right-2 absolute flex h-5 w-5 items-center justify-center rounded-full bg-green-400 font-bold text-black text-xs">
								{totalConnected}
							</div>
						</>
					)}
				</div>
			</div>
		);
	}

	// Full sidebar mode for desktop
	const totalConnected = spacesAndBots.length + connectedGuests.length;
	const allVisibleBeings = [...spacesAndBots, ...connectedGuests, ...disconnectedGuests];

	return (
		<div className="flex h-full w-16 flex-col items-center py-4 sm:w-20">
			{/* Connection status indicator */}
			<div className="flex flex-col items-center gap-1 mb-4">
				<div className="font-medium text-outline text-white/60 text-xs">
					{totalConnected}
				</div>
				{connectionState !== 'connected' && (
					<div className={`h-2 w-2 rounded-full ${
						connectionState === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
					}`} title={connectionState === 'connecting' ? 'Connecting...' : 'Disconnected'} />
				)}
			</div>

			{/* Spaces and Bots (always online) */}
			{spacesAndBots.map((being) => (
				<div key={being.id} className="relative mb-3">
					<Avatar
						beingId={being.id}
						beingType={being.type}
						size="sm"
						className="ring-2 ring-blue-400/50 transition-all hover:scale-110 hover:ring-blue-400"
					/>
					{/* Always online indicator for spaces/bots */}
					<div className="-bottom-0.5 -right-0.5 absolute h-3 w-3 rounded-full border-2 border-black bg-blue-400" />
				</div>
			))}

			{/* Connected Guests */}
			{connectedGuests.map((being) => (
				<div key={being.id} className="relative mb-3">
					<Avatar
						beingId={being.id}
						beingType={being.type}
						size="sm"
						className="ring-2 ring-green-400/50 transition-all hover:scale-110 hover:ring-green-400"
					/>
					{/* Online indicator */}
					<div className="-bottom-0.5 -right-0.5 absolute h-3 w-3 rounded-full border-2 border-black bg-green-400" />
				</div>
			))}

			{/* Separator if there are disconnected guests */}
			{disconnectedGuests.length > 0 && (spacesAndBots.length > 0 || connectedGuests.length > 0) && (
				<div className="my-4 h-px w-8 bg-white/20" />
			)}

			{/* Disconnected Guests */}
			{disconnectedGuests.map((being) => (
				<div key={being.id} className="relative mb-3 opacity-50">
					<Avatar
						beingId={being.id}
						beingType={being.type}
						size="sm"
						className="ring-2 ring-gray-600/30"
					/>
					{/* Offline indicator */}
					<div className="-bottom-0.5 -right-0.5 absolute h-3 w-3 rounded-full border-2 border-black bg-gray-500" />
				</div>
			))}
		</div>
	);
}
