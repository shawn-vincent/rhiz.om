// src/app/_components/being-presence.tsx
"use client";

import { BeingPresenceSimple } from "./being-presence-simple";

interface BeingPresenceProps {
	compact?: boolean;
	currentSpaceId?: string; // The space/location we're showing presence for
}

export function BeingPresence({
	compact = false,
	currentSpaceId,
}: BeingPresenceProps) {
	// Only use the simple system now
	return (
		<BeingPresenceSimple compact={compact} currentSpaceId={currentSpaceId} />
	);
}