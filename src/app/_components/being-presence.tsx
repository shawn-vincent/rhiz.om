// src/app/_components/being-presence.tsx
"use client";

import { Avatar } from "~/components/ui/avatar";

// Mock data for now
const mockBeings = [
	{
		id: "@alice",
		name: "Alice",
		type: "guest" as const,
		isOnline: true,
	},
	{
		id: "@bob-the-builder",
		name: "Bob",
		type: "guest" as const,
		isOnline: true,
	},
	{
		id: "@rhiz.om-assistant",
		name: "Rhiz Assistant",
		type: "bot" as const,
		isOnline: true,
	},
	{
		id: "@charlie",
		name: "Charlie",
		type: "guest" as const,
		isOnline: false,
	},
	{
		id: "@diana-explorer",
		name: "Diana",
		type: "guest" as const,
		isOnline: true,
	},
];

interface BeingPresenceProps {
	compact?: boolean;
}

export function BeingPresence({ compact = false }: BeingPresenceProps) {
	const onlineBeings = mockBeings.filter((being) => being.isOnline);
	const offlineBeings = mockBeings.filter((being) => !being.isOnline);

	// Compact mode for mobile/narrow screens
	if (compact) {
		const firstBeing = onlineBeings[0];
		const hasMultiple = onlineBeings.length > 1;
		
		if (!firstBeing) return null;

		return (
			<div className="relative flex items-center">
				<div className="relative">
					<Avatar
						beingId={firstBeing.id}
						beingType={firstBeing.type}
						size="sm"
						className="ring-2 ring-green-400/50"
					/>
					{/* Online indicator */}
					<div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-black bg-green-400" />
					
					{/* Stack indicator for multiple beings */}
					{hasMultiple && (
						<>
							{/* Shadow avatar behind */}
							<div className="absolute -top-1 -right-1 -z-10 h-8 w-8 rounded-full bg-gray-600/50 ring-1 ring-green-400/30" />
							{/* Count badge */}
							<div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-400 text-black text-xs font-bold">
								{onlineBeings.length}
							</div>
						</>
					)}
				</div>
			</div>
		);
	}

	// Full sidebar mode for desktop
	return (
		<div className="flex h-full w-16 flex-col items-center py-4 sm:w-20">
			{/* Online beings */}
			<div className="flex flex-col items-center gap-3">
				<div className="text-outline text-white/60 text-xs font-medium">
					{onlineBeings.length}
				</div>
				{onlineBeings.map((being) => (
					<div key={being.id} className="relative">
						<Avatar
							beingId={being.id}
							beingType={being.type}
							size="sm"
							className="ring-2 ring-green-400/50 transition-all hover:scale-110 hover:ring-green-400"
						/>
						{/* Online indicator */}
						<div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-black bg-green-400" />
					</div>
				))}
			</div>

			{/* Separator */}
			{offlineBeings.length > 0 && onlineBeings.length > 0 && (
				<div className="my-4 h-px w-8 bg-white/20" />
			)}

			{/* Offline beings */}
			{offlineBeings.length > 0 && (
				<div className="flex flex-col items-center gap-3">
					{offlineBeings.map((being) => (
						<div key={being.id} className="relative opacity-40">
							<Avatar
								beingId={being.id}
								beingType={being.type}
								size="sm"
								className="ring-2 ring-gray-600/30"
							/>
							{/* Offline indicator */}
							<div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-black bg-gray-500" />
						</div>
					))}
				</div>
			)}
		</div>
	);
}