// src/app/_components/being-presence.tsx
"use client";

import type { BeingType } from "packages/entity-kit/src/types";
import { Avatar } from "~/components/ui/avatar";
import { useSpacePresence } from "~/hooks/use-state-sync";
import type { BeingId } from "~/server/db/types";

interface BeingPresenceData {
	id: string;
	name: string;
	type: BeingType;
	isOnline: boolean;
}

interface BeingPresenceProps {
	compact?: boolean;
	currentSpaceId?: string; // The space/location we're showing presence for
}

export function BeingPresence({
	compact = false,
	currentSpaceId,
}: BeingPresenceProps) {
	// Use the new state sync system instead of manual SSE + tRPC
	const {
		presence,
		error: presenceError,
		isConnected,
		retry,
	} = useSpacePresence(currentSpaceId as BeingId);

	// Transform the new format to the old format for compatibility
	const beings: BeingPresenceData[] =
		presence?.beings.map(({ being, connectionStatus }) => ({
			id: being.id,
			name: being.name,
			type: being.type as BeingType,
			isOnline: connectionStatus === "online",
		})) ?? [];

	const connectionState = isConnected ? "connected" : "disconnected";
	const isLoading = !presence && !presenceError;

	// Separate beings by type and connection status
	const connectedGuests = beings.filter(
		(being) => being.type === "guest" && being.isOnline,
	);
	const disconnectedGuests = beings.filter(
		(being) => being.type === "guest" && !being.isOnline,
	);
	const spacesAndBots = beings.filter(
		(being) => being.type === "space" || being.type === "bot",
	);

	// Compact mode for mobile/narrow screens
	if (compact) {
		const allVisibleBeings = [
			...spacesAndBots,
			...connectedGuests,
			...disconnectedGuests,
		];
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
								: "opacity-60 ring-gray-400/50"
						}`}
					/>
					{/* Online/offline indicator */}
					<div
						className={`-bottom-0.5 -right-0.5 absolute h-3 w-3 rounded-full border-2 border-black ${
							firstBeing.isOnline ? "bg-green-400" : "bg-gray-500"
						}`}
					/>

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

	return (
		<div className="flex h-full w-16 flex-col items-center py-4 sm:w-20">
			{/* Connection status indicator */}
			<div className="mb-4 flex flex-col items-center gap-1">
				<div className="font-medium text-outline text-white/60 text-xs">
					{totalConnected}
				</div>
				{!isConnected && (
					<div
						className="h-2 w-2 rounded-full bg-red-400"
						title="Disconnected"
					/>
				)}
				{/* Show retry button if there's an error */}
				{presenceError && (
					<button
						onClick={retry}
						className="text-red-400 text-xs hover:text-red-300"
						title="Retry connection"
					>
						↻
					</button>
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
			{disconnectedGuests.length > 0 &&
				(spacesAndBots.length > 0 || connectedGuests.length > 0) && (
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
