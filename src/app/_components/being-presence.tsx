// src/app/_components/being-presence.tsx
"use client";

import { useSession } from "next-auth/react";
import type { BeingType } from "packages/entity-kit/src/types";
import { useEffect, useRef, useState } from "react";
import { BeingEditModal } from "~/components/being-edit-modal";
import { Avatar } from "~/components/ui/avatar";
import { SuperuserBadge } from "~/components/ui/superuser-badge";
import { useSpacePresence } from "~/hooks/use-state-sync";
import { canEdit as canEditPermission, isSuperuser } from "~/lib/permissions";
import type { BeingId } from "~/server/db/types";
import { api } from "~/trpc/react";
import { EntityCard } from "../../../packages/entity-kit/src/components/ui/EntityCard";

interface BeingPresenceData {
	id: string;
	name: string;
	type: BeingType;
	isOnline: boolean;
	ownerId?: string | null;
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

	const { data: session } = useSession();
	const currentUserBeingId = session?.user?.beingId;

	// Fetch current user's being to check superuser status
	const { data: currentUserBeing } = api.being.getById.useQuery(
		{ id: currentUserBeingId ?? "" },
		{ enabled: !!currentUserBeingId },
	);
	const isCurrentUserSuperuser = isSuperuser(currentUserBeing);

	// Transform the new format to the old format for compatibility
	const beings: BeingPresenceData[] =
		presence?.beings.map(({ being, connectionStatus }) => ({
			id: being.id,
			name: being.name,
			type: being.type as BeingType,
			isOnline: connectionStatus === "online",
			ownerId: being.ownerId,
		})) ?? [];

	const connectionState = isConnected ? "connected" : "disconnected";
	const isLoading = !presence && !presenceError;

	// Separate beings by type and connection status
	const spacesAndBots = beings.filter(
		(being) => being.type === "space" || being.type === "bot",
	);
	const connectedGuests = beings.filter(
		(being) => being.type === "guest" && being.isOnline,
	);
	const disconnectedGuests = beings.filter(
		(being) => being.type === "guest" && !being.isOnline,
	);

	// Consistent ordering: spaces/bots first, then connected guests, then disconnected
	const orderedBeings = [
		...spacesAndBots,
		...connectedGuests,
		...disconnectedGuests,
	];

	// State for showing popover and editing
	const [showPopover, setShowPopover] = useState(false);
	const [selectedBeingId, setSelectedBeingId] = useState<string | null>(null);
	const [editingBeingId, setEditingBeingId] = useState<string | null>(null);
	const popoverRef = useRef<HTMLDivElement>(null);

	// Check if current user can edit a being
	const canEdit = (being: BeingPresenceData) => {
		return canEditPermission(
			currentUserBeingId,
			being.ownerId,
			isCurrentUserSuperuser,
		);
	};

	// Click outside handler
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(event.target as Node)
			) {
				setShowPopover(false);
				setSelectedBeingId(null);
			}
		}

		if (showPopover) {
			document.addEventListener("mousedown", handleClickOutside);
			return () =>
				document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [showPopover]);

	// Compact mode for mobile/narrow screens
	if (compact) {
		const firstBeing = orderedBeings[0];
		const totalConnected = spacesAndBots.length + connectedGuests.length;
		const hasMultiple = orderedBeings.length > 1;

		if (!firstBeing) return null;

		return (
			<div className="relative">
				<div
					className="relative flex cursor-pointer items-center"
					onClick={() => setShowPopover(!showPopover)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							setShowPopover(!showPopover);
						}
					}}
					tabIndex={0}
					role="button"
					aria-label="Show user details"
				>
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

				{/* Popover for being cards */}
				{showPopover && (
					<div
						ref={popoverRef}
						className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-md border bg-popover p-2 shadow-md"
					>
						<div className="space-y-1">
							{orderedBeings.map((being) => (
								<EntityCard
									key={being.id}
									entity={being}
									isOnline={being.isOnline}
									variant="compact"
									onClick={() => setSelectedBeingId(being.id)}
									onEdit={
										canEdit(being)
											? () => {
													setEditingBeingId(being.id);
													setShowPopover(false);
												}
											: undefined
									}
									isSelected={selectedBeingId === being.id}
									showEditButton={
										!!(selectedBeingId === being.id && canEdit(being))
									}
								/>
							))}
						</div>
					</div>
				)}

				{/* Edit modal for compact mode */}
				<BeingEditModal
					beingId={editingBeingId}
					isOpen={!!editingBeingId}
					onClose={() => setEditingBeingId(null)}
				/>
			</div>
		);
	}

	// Full sidebar mode for desktop
	const totalConnected = spacesAndBots.length + connectedGuests.length;

	return (
		<div className="relative flex h-full w-16 flex-col items-center py-4 sm:w-20">
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
						type="button"
						onClick={retry}
						className="text-red-400 text-xs hover:text-red-300"
						title="Retry connection"
					>
						↻
					</button>
				)}
			</div>

			{/* Render beings in consistent order */}
			{orderedBeings.map((being) => {
				const isSpace = being.type === "space" || being.type === "bot";
				const isDisconnected = !being.isOnline && being.type === "guest";

				return (
					<div key={being.id} className="relative mb-3">
						<div
							className={`relative cursor-pointer ${isDisconnected ? "opacity-50" : ""}`}
							onClick={() => {
								setSelectedBeingId(being.id);
								setShowPopover(true);
							}}
						>
							<Avatar
								beingId={being.id}
								beingType={being.type}
								size="sm"
								className={`ring-2 transition-all hover:scale-110 ${
									isSpace
										? "ring-blue-400/50 hover:ring-blue-400"
										: being.isOnline
											? "ring-green-400/50 hover:ring-green-400"
											: "ring-gray-600/30"
								}`}
							/>
							{/* Online/offline indicator */}
							<div
								className={`-bottom-0.5 -right-0.5 absolute h-3 w-3 rounded-full border-2 border-black ${
									isSpace
										? "bg-blue-400"
										: being.isOnline
											? "bg-green-400"
											: "bg-gray-500"
								}`}
							/>
						</div>

						{/* Popover for this specific being */}
						{showPopover && selectedBeingId === being.id && (
							<div
								ref={popoverRef}
								className="-translate-y-1/2 absolute top-1/2 left-[calc(100%+8px)] z-50 w-64 rounded-md border bg-popover p-2 shadow-md"
							>
								<EntityCard
									entity={being}
									isOnline={being.isOnline}
									onEdit={
										canEdit(being)
											? () => {
													setEditingBeingId(being.id);
													setShowPopover(false);
												}
											: undefined
									}
									showEditButton={!!canEdit(being)}
								/>
							</div>
						)}
					</div>
				);
			})}

			{/* Separator if there are disconnected guests */}
			{disconnectedGuests.length > 0 &&
				(spacesAndBots.length > 0 || connectedGuests.length > 0) && (
					<div className="my-4 h-px w-8 bg-white/20" />
				)}

			{/* Edit modal */}
			<BeingEditModal
				beingId={editingBeingId}
				isOpen={!!editingBeingId}
				onClose={() => setEditingBeingId(null)}
			/>
		</div>
	);
}
