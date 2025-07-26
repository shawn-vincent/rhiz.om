// src/app/_components/chat.tsx
"use client";

import { Send } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { RichContent } from "~/app/_components/rich-content";
import { Avatar, type BeingType } from "~/components/ui/avatar";
import ErrorBoundary from "~/components/ui/error-boundary";
import {
	callIntentionAPI,
	getCachedBeing,
} from "~/hooks/use-simple-sync";
import { useSpaceDataContext } from "~/hooks/use-space-data-context";
import { logger } from "~/lib/logger.client";
import type { ContentNode } from "~/server/db/content-types";
import type { BeingId, Intention } from "~/server/db/types";

const AI_AGENT_BEING_ID = "@rhiz.om-assistant";
const chatLogger = logger.child({ name: "Chat" });

interface ChatProps {
	currentUserBeingId: string;
	beingId: string;
}

export function Chat({ currentUserBeingId, beingId }: ChatProps) {
	const [message, setMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const chatContainerRef = useRef<HTMLUListElement>(null);
	const bottomAnchorRef = useRef<HTMLLIElement>(null);

	// Use the shared space data context
	const { utterances, error, refresh } = useSpaceDataContext();

	// Group messages by owner (consecutive messages from same user)
	const groupedMessages = useMemo(() => {
		const groups: Array<{ ownerId: string; messages: Intention[] }> = [];
		let currentGroup: { ownerId: string; messages: Intention[] } | null = null;

		for (const utterance of utterances) {
			if (currentGroup && currentGroup.ownerId === utterance.ownerId) {
				currentGroup.messages.push(utterance);
			} else {
				currentGroup = { ownerId: utterance.ownerId, messages: [utterance] };
				groups.push(currentGroup);
			}
		}
		return groups;
	}, [utterances]);

	// Handle message submission
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!message.trim() || isSubmitting) return;

		setIsSubmitting(true);
		try {
			await callIntentionAPI({
				action: "create",
				spaceId: beingId,
				data: {
					content: [message.trim()],
					type: "utterance",
					state: "complete",
				},
			});
			setMessage("");
		} catch (error) {
			console.error("Failed to send message:", error);
			chatLogger.error(error, "Failed to send message");
		} finally {
			setIsSubmitting(false);
		}
	};

	// Auto-scroll to bottom when new messages arrive
	useLayoutEffect(() => {
		if (bottomAnchorRef.current) {
			bottomAnchorRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [utterances]);

	// Mount-time scroll to bottom
	useLayoutEffect(() => {
		if (chatContainerRef.current && typeof window !== "undefined") {
			const container = chatContainerRef.current;
			const originalScrollBehavior = container.style.scrollBehavior;

			container.style.scrollBehavior = "auto";
			container.scrollTop = container.scrollHeight;

			setTimeout(() => {
				container.style.scrollBehavior = originalScrollBehavior;
			}, 0);
		}
	}, []);

	return (
		<ErrorBoundary>
			<div className="relative flex h-full w-full flex-col bg-white/20">
				{/* Top shadow overlay */}
				<div className="pointer-events-none absolute top-0 right-0 left-0 z-10 h-4 bg-gradient-to-b from-black/30 to-transparent" />

				{/* Error indicator */}
				{error && (
					<div className="bg-red-500/20 px-4 py-2 text-red-100 text-sm">
						Connection issue: {error}
						<button
							type="button"
							onClick={refresh}
							className="ml-2 underline hover:no-underline"
						>
							Retry
						</button>
					</div>
				)}

				<ul
					ref={chatContainerRef}
					className="flex grow flex-col gap-3 overflow-y-auto px-4 pt-4 pb-0 sm:px-6"
				>
					{groupedMessages.map((group, groupIndex) => {
						const isCurrentUser = group.ownerId === currentUserBeingId;
						const beingData = getCachedBeing(group.ownerId);
						const knownBeingType =
							group.ownerId === AI_AGENT_BEING_ID
								? "bot"
								: (beingData?.type as BeingType) || "guest";
						const firstMessage = group.messages[0];
						const firstMessageTime = firstMessage
							? new Date(firstMessage.createdAt).toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit",
								})
							: "";

						return (
							<li
								key={`${group.ownerId}-${group.messages[0]?.id || groupIndex}`}
								className={`group flex items-end gap-2 ${isCurrentUser ? "flex-row-reverse" : ""}`}
							>
								<Avatar
									beingId={group.ownerId}
									beingType={knownBeingType}
									autoDetectType={false}
									size="sm"
								/>
								<div
									className={`flex w-full max-w-[75%] flex-col gap-0.5 ${isCurrentUser ? "items-end" : "items-start"}`}
								>
									<header
										className={`flex items-baseline gap-2 ${isCurrentUser ? "flex-row-reverse" : ""}`}
									>
										<span className="font-medium text-outline text-white">
											{beingData?.name || group.ownerId}
										</span>
										<time className="text-gray-500 text-outline text-xs dark:text-gray-400">
											{firstMessageTime}
										</time>
									</header>
									<div
										className={`flex flex-col gap-0.5 ${isCurrentUser ? "items-end" : "items-start"}`}
									>
										{group.messages.map((utterance) => (
											<div
												key={utterance.id}
												className={`rounded-2xl px-4 py-2 shadow ${isCurrentUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900 dark:bg-gray-700/60 dark:text-gray-50"}`}
											>
												<RichContent
													nodes={utterance.content as ContentNode[]}
												/>
												{utterance.state === "active" && (
													<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
												)}
											</div>
										))}
									</div>
								</div>
							</li>
						);
					})}
					<li ref={bottomAnchorRef} className="h-px w-full" />
				</ul>

				{/* Bottom shadow overlay */}
				<div className="pointer-events-none absolute right-0 bottom-20 left-0 z-10 h-4 bg-gradient-to-t from-white/20 to-transparent" />

				<form
					onSubmit={handleSubmit}
					className="sticky bottom-0 flex w-full min-w-0 items-center gap-2 border-gray-200 border-t bg-white px-3 py-3 sm:px-4 dark:border-gray-800 dark:bg-gray-900"
				>
					<input
						type="text"
						placeholder="Say something..."
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						disabled={isSubmitting}
						className="min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
					/>
					<button
						type="submit"
						className="shrink-0 rounded-full bg-blue-500 p-2 text-white transition hover:bg-blue-600 disabled:opacity-50"
						disabled={isSubmitting || !message.trim()}
						aria-label={isSubmitting ? "Sending..." : "Send message"}
					>
						<Send className="size-4" />
					</button>
				</form>
			</div>
		</ErrorBoundary>
	);
}
