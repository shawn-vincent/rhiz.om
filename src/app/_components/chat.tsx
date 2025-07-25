// src/app/_components/chat.tsx
"use client";

import { ChatSimple } from "./chat-simple";

interface ChatProps {
	currentUserBeingId: string;
	beingId: string;
}

export function Chat({ currentUserBeingId, beingId }: ChatProps) {
	// Only use the simple system now
	return (
		<ChatSimple currentUserBeingId={currentUserBeingId} beingId={beingId} />
	);
}