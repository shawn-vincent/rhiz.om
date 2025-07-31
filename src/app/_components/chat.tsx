// src/app/_components/chat.tsx
"use client";

import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import superjson from "superjson";
import { RichContent } from "~/app/_components/rich-content";
import { ChatInput, type ChatInputRef } from "~/components/chat-input";
import { FloatingVideoOrbs } from "~/components/floating-video-orbs";
import { Avatar, type BeingType } from "~/components/ui/avatar";
import ErrorBoundary from "~/components/ui/error-boundary";
import { useSync } from "~/hooks/use-sync";
import { logger } from "~/lib/logger.client";
import type { ContentNode } from "~/server/db/content-types";
import type { BeingId, Intention } from "~/server/db/types";
import { api } from "~/trpc/react";

const AI_AGENT_BEING_ID: BeingId = "@rhiz.om-assistant";
const chatLogger = logger.child({ name: "Chat" });

interface ChatProps {
	currentUserBeingId: BeingId;
	beingId: BeingId;
}

export function Chat({ currentUserBeingId, beingId }: ChatProps) {
	const [message, setMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showScrollToBottom, setShowScrollToBottom] = useState(false);
	// Streaming state no longer needed - handled by intention updates

	const chatContainerRef = useRef<HTMLUListElement>(null);
	const bottomAnchorRef = useRef<HTMLLIElement>(null);
	const chatInputRef = useRef<ChatInputRef>(null);

	// Use sync for real-time intentions and beings
	const { beings: syncBeings, intentions: utterances, room } = useSync(beingId);

	// Utterances come directly from sync system with real-time updates

	// tRPC mutation for creating utterances with optimistic update
	const createUtterance = api.intention.createUtterance.useMutation({
		onSuccess: () => {
			// Focus the input after successful submission
			setTimeout(() => {
				chatInputRef.current?.focus();
			}, 100);
		},
		onError: (error) => {
			console.error("Failed to send message:", error);
			chatLogger.error(error, "Failed to send message");

			// Show specific error message to user
			if (error.message.includes("missing beingId")) {
				console.warn(
					"Authentication issue - user needs to re-login:",
					error.message,
				);
			}

			// Focus the input even after errors
			setTimeout(() => {
				chatInputRef.current?.focus();
			}, 100);
		},
	});

	// Group messages by owner (consecutive messages from same user)
	const groupedMessages = useMemo(() => {
		const groups: Array<{ ownerId: BeingId; messages: Intention[] }> = [];
		let currentGroup: { ownerId: BeingId; messages: Intention[] } | null = null;

		for (const utterance of utterances) {
			if (
				currentGroup &&
				currentGroup.ownerId === (utterance.ownerId as BeingId)
			) {
				currentGroup.messages.push(utterance);
			} else {
				currentGroup = {
					ownerId: utterance.ownerId as BeingId,
					messages: [utterance],
				};
				groups.push(currentGroup);
			}
		}
		return groups;
	}, [utterances]);

	// Handle message submission
	const handleSubmit = async () => {
		if (!message.trim() || isSubmitting) return;

		setIsSubmitting(true);
		try {
			await createUtterance.mutateAsync({
				content: message.trim(),
				beingId,
			});
			setMessage("");
		} finally {
			setIsSubmitting(false);
		}
	};

	// Check if user is scrolled to bottom
	const isScrolledToBottom = useCallback(() => {
		const container = chatContainerRef.current;
		if (!container) return true;

		const threshold = 50; // pixels from bottom
		return (
			container.scrollHeight - container.scrollTop - container.clientHeight <
			threshold
		);
	}, []);

	// Handle scroll events to show/hide scroll-to-bottom button
	const handleScroll = useCallback(() => {
		setShowScrollToBottom(!isScrolledToBottom());
	}, [isScrolledToBottom]);

	// Scroll to bottom function
	const scrollToBottom = () => {
		if (bottomAnchorRef.current) {
			bottomAnchorRef.current.scrollIntoView({ behavior: "smooth" });
		}
		setShowScrollToBottom(false);
	};

	// Auto-scroll to bottom when new messages arrive (including streaming updates)
	useLayoutEffect(() => {
		// Only auto-scroll if already near bottom
		const container = chatContainerRef.current;
		if (!container) return;

		const threshold = 50;
		const isNearBottom =
			container.scrollHeight - container.scrollTop - container.clientHeight <
			threshold;

		if (isNearBottom && bottomAnchorRef.current) {
			bottomAnchorRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [utterances]);

	// Mount-time scroll to bottom (immediate, no animation)
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

	// Set up scroll listener for scroll-to-bottom button
	useEffect(() => {
		const container = chatContainerRef.current;
		if (!container) return;

		container.addEventListener("scroll", handleScroll);
		return () => container.removeEventListener("scroll", handleScroll);
	}, [handleScroll]);

	// Streaming is now handled automatically via intention updates
	// No separate EventSource connections needed

	return (
		<ErrorBoundary>
			<FloatingVideoOrbs
				participants={syncBeings
					.filter(
						(b) =>
							b.id !== currentUserBeingId &&
							b.type === "guest" &&
							!b.botModel &&
							room?.remoteParticipants?.has(b.id),
					)
					.map((b) => b.id)}
				room={room}
			/>
			<div className="relative flex h-full w-full flex-col bg-white/20">
				{/* Top shadow overlay */}
				<div className="pointer-events-none absolute top-0 right-0 left-0 z-10 h-4 bg-gradient-to-b from-black/30 to-transparent" />

				<ul
					ref={chatContainerRef}
					className="flex grow flex-col gap-3 overflow-y-auto px-4 pt-4 pb-0 sm:px-6"
				>
					{groupedMessages.map((group, groupIndex) => {
						const isCurrentUser = group.ownerId === currentUserBeingId;
						// Use sync beings for real-time updates
						const beingData = syncBeings.find((b) => b.id === group.ownerId);
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
										{group.messages.map((utterance) => {
											const content = utterance.content as ContentNode[];
											const isEmpty =
												!content ||
												content.length === 0 ||
												(content.length === 1 && content[0] === "");
											const isError = utterance.state === "failed";

											return (
												<div
													key={utterance.id}
													className={`rounded-2xl px-4 py-2 shadow ${
														isError
															? "border border-red-300 bg-red-100/90 text-red-900 dark:border-red-500/50 dark:bg-red-950/50 dark:text-red-100"
															: isCurrentUser
																? "bg-blue-500 text-white"
																: "bg-gray-100 text-gray-900 dark:bg-gray-700/60 dark:text-gray-50"
													}`}
												>
													{isError ? (
														<div className="flex items-center gap-2 text-outline-error">
															<span className="text-red-500">⚠️</span>
															<span className="font-medium">
																Error:{" "}
																{content && content.length > 0
																	? String(content[0])
																	: "Failed to get response"}
															</span>
														</div>
													) : isEmpty && utterance.state === "complete" ? (
														<div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
															<span>⚠️</span>
															<span className="italic">
																Empty response received
															</span>
														</div>
													) : (
														<RichContent nodes={content} />
													)}
													{utterance.state === "active" && (
														<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
													)}
												</div>
											);
										})}
									</div>
								</div>
							</li>
						);
					})}
					<li ref={bottomAnchorRef} className="h-px w-full" />
				</ul>

				{/* Bottom shadow overlay */}
				<div className="pointer-events-none absolute right-0 bottom-20 left-0 z-10 h-4 bg-gradient-to-t from-white/20 to-transparent" />

				{/* Scroll to bottom button */}
				{showScrollToBottom && (
					<button
						type="button"
						onClick={scrollToBottom}
						className="absolute right-4 bottom-24 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg transition-all duration-200 hover:bg-blue-600 hover:shadow-xl"
						aria-label="Scroll to bottom"
					>
						<svg
							className="h-5 w-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 14l-7 7m0 0l-7-7m7 7V3"
							/>
						</svg>
					</button>
				)}

				<div className="sticky bottom-0 flex w-full min-w-0 items-center gap-2 border-gray-200 border-t bg-white px-3 py-3 sm:px-4 dark:border-gray-800 dark:bg-gray-900">
					<ChatInput
						ref={chatInputRef}
						value={message}
						onChange={setMessage}
						onSubmit={handleSubmit}
						disabled={isSubmitting}
						placeholder="Say something..."
						currentUserBeingId={currentUserBeingId}
						room={room}
					/>
				</div>
			</div>
		</ErrorBoundary>
	);
}
