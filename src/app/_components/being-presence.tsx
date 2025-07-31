// src/app/_components/being-presence.tsx
"use client";

import { useSession } from "next-auth/react";
import type { BeingType } from "packages/entity-kit/src/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BeingEditModal } from "~/components/being-edit-modal";
import { Avatar } from "~/components/ui/avatar";
import { useSync } from "~/hooks/use-sync";
import { canEdit as canEditPermission, isSuperuser } from "~/lib/permissions";
import type { BeingId } from "~/lib/types";
import { api } from "~/trpc/react";
import { EntityCard } from "../../../packages/entity-kit/src/components/ui/EntityCard";

interface BeingPresenceData {
	id: BeingId;
	name: string;
	type: BeingType;
	isOnline: boolean;
	ownerId?: BeingId | null;
}

interface BeingPresenceProps {
	compact?: boolean;
	currentSpaceId?: BeingId;
}

export function BeingPresence({
	compact = false,
	currentSpaceId,
}: BeingPresenceProps) {
	// Use sync for real-time being and intention updates
	const { beings: syncBeings, isConnected } = currentSpaceId
		? useSync(currentSpaceId)
		: { beings: [], isConnected: false };

	// Filter beings to current space (beings from sync are already filtered)
	const beings = syncBeings;

	const { data: session } = useSession();
	const currentUserBeingId = session?.user?.beingId;

	// Memoize expensive computations
	const {
		beingPresenceData,
		currentUserBeing,
		isCurrentUserSuperuser,
		spacesAndBots,
		connectedGuests,
		disconnectedGuests,
		orderedBeings,
	} = useMemo(() => {
		// Get current user's being from beings list to check superuser status
		const currentUserBeing = beings.find((b) => b.id === currentUserBeingId);
		const isCurrentUserSuperuser = isSuperuser(currentUserBeing);

		// Transform beings to match expected format
		const beingPresenceData: BeingPresenceData[] = beings.map((being) => ({
			id: being.id,
			name: being.name,
			type: being.type as BeingType,
			isOnline: true, // All beings are "online" for now
			ownerId: being.ownerId,
		}));

		// Separate beings by type and connection status
		const spacesAndBots = beingPresenceData.filter(
			(being) => being.type === "space" || being.type === "bot",
		);
		const connectedGuests = beingPresenceData.filter(
			(being) => being.type === "guest" && being.isOnline,
		);
		const disconnectedGuests = beingPresenceData.filter(
			(being) => being.type === "guest" && !being.isOnline,
		);

		// Consistent ordering
		const orderedBeings = [
			...spacesAndBots,
			...connectedGuests,
			...disconnectedGuests,
		];

		return {
			beingPresenceData,
			currentUserBeing,
			isCurrentUserSuperuser,
			spacesAndBots,
			connectedGuests,
			disconnectedGuests,
			orderedBeings,
		};
	}, [beings, currentUserBeingId]);

	// State for showing popover and editing
	const [showPopover, setShowPopover] = useState(false);
	const [selectedBeingId, setSelectedBeingId] = useState<BeingId | null>(null);
	const [editingBeingId, setEditingBeingId] = useState<BeingId | null>(null);
	const popoverRef = useRef<HTMLDivElement>(null);

	// Check if current user can edit a being - memoize the function and create a map for O(1) lookup
	const canEditMap = useMemo(() => {
		const map = new Map<string, boolean>();
		for (const being of beingPresenceData) {
			map.set(
				being.id,
				canEditPermission(
					currentUserBeingId,
					being.ownerId,
					isCurrentUserSuperuser,
				),
			);
		}
		return map;
	}, [beingPresenceData, currentUserBeingId, isCurrentUserSuperuser]);

	const canEdit = useCallback(
		(being: BeingPresenceData) => canEditMap.get(being.id) ?? false,
		[canEditMap],
	);

	// Memoize event handlers to prevent unnecessary re-renders
	const handleTogglePopover = useCallback(() => {
		setShowPopover(!showPopover);
	}, [showPopover]);

	const handleClosePopover = useCallback(() => {
		setShowPopover(false);
		setSelectedBeingId(null);
	}, []);

	const handleEditBeing = useCallback((beingId: BeingId) => {
		setEditingBeingId(beingId);
		setShowPopover(false);
	}, []);

	const handleCloseEditModal = useCallback(() => {
		setEditingBeingId(null);
	}, []);

	const handleSelectBeing = useCallback((beingId: BeingId) => {
		setSelectedBeingId(beingId);
		setShowPopover(true);
	}, []);

	// Click outside handler
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(event.target as Node)
			) {
				handleClosePopover();
			}
		}

		if (showPopover) {
			document.addEventListener("mousedown", handleClickOutside);
			return () =>
				document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [showPopover, handleClosePopover]);

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
					onClick={handleTogglePopover}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							handleTogglePopover();
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
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									setSelectedBeingId(being.id);
									setShowPopover(true);
								}
							}}
							tabIndex={0}
							role="button"
							aria-label={`View details for ${being.name}`}
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
