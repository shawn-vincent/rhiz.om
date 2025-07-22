// src/app/_components/chat.tsx
"use client";

import { Send } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import superjson from "superjson";
import { RichContent } from "~/app/_components/rich-content";
import { Avatar } from "~/components/ui/avatar";
import ErrorBoundary from "~/components/ui/error-boundary";
import { useSpaceIntentions } from "~/hooks/use-state-sync";
import { logger } from "~/lib/logger.client";
import type { ContentNode } from "~/server/db/content-types";
import type { BeingId } from "~/server/db/types";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";

const AI_AGENT_BEING_ID = "@rhiz.om-assistant";
const chatLogger = logger.child({ name: "Chat" });

type Utterance = RouterOutputs["intention"]["getAllUtterancesInBeing"][number];

interface ChatProps {
	currentUserBeingId: string;
	beingId: string;
}

export function Chat({ currentUserBeingId, beingId }: ChatProps) {
	const [message, setMessage] = useState("");
	const [streamingResponses, setStreamingResponses] = useState<
		Record<string, string>
	>({});
	const [isAtBottom, setIsAtBottom] = useState(true); // State to track if user is at the bottom

	const chatContainerRef = useRef<HTMLUListElement>(null); // Ref for the scrollable chat container
	const bottomAnchorRef = useRef<HTMLLIElement>(null); // Ref for the invisible anchor at the bottom

	const utils = api.useUtils();

	// Use the new state sync system instead of manual tRPC query
	const {
		utterances,
		error: intentionsError,
		retry,
	} = useSpaceIntentions(beingId as BeingId);

	// Keep fallback for now during migration
	const [fallbackUtterances] =
		api.intention.getAllUtterancesInBeing.useSuspenseQuery(
			{ beingId },
			{
				staleTime: 0,
			},
		);

	// Use synced utterances if available, otherwise fallback
	const displayUtterances =
		utterances.length > 0 ? utterances : (fallbackUtterances ?? []);

	// Get all unique being IDs from utterances to fetch their names
	const uniqueBeingIds = useMemo(() => {
		const ids = new Set<string>();
		for (const utterance of displayUtterances) {
			// All utterances should have ownerId
			ids.add(utterance.ownerId);
		}
		return Array.from(ids);
	}, [displayUtterances]);

	// Fetch all beings at once instead of individual queries
	const { data: allBeings } = api.being.getAll.useQuery();

	// Create a map of being ID to being name
	const beingNames = useMemo(() => {
		const nameMap: Record<string, string> = {};
		if (allBeings) {
			for (const being of allBeings) {
				nameMap[being.id] = being.name;
			}
		}
		// Add fallbacks for any beings not found
		for (const beingId of uniqueBeingIds) {
			if (!nameMap[beingId]) {
				nameMap[beingId] = beingId; // Fallback to ID
			}
		}
		return nameMap;
	}, [allBeings, uniqueBeingIds]);

	const groupedMessages = useMemo(() => {
		// This logic remains the same and will work with the streaming updates
		const combinedUtterances = displayUtterances.map((utt) => {
			if (streamingResponses[utt.id]) {
				return { ...utt, content: [streamingResponses[utt.id]] };
			}
			return utt;
		});

		const groups: Array<{ ownerId: string; messages: Utterance[] }> = [];
		let currentGroup: { ownerId: string; messages: Utterance[] } | null = null;

		for (const utterance of combinedUtterances) {
			if (currentGroup && currentGroup.ownerId === utterance.ownerId) {
				currentGroup.messages.push(utterance);
			} else {
				currentGroup = { ownerId: utterance.ownerId, messages: [utterance] };
				groups.push(currentGroup);
			}
		}
		return groups;
	}, [displayUtterances, streamingResponses]);

	const createUtterance = api.intention.createUtterance.useMutation({
		onSuccess: async (data) => {
			setMessage("");
			// No need to manually invalidate - the new state sync system handles this automatically!
		},
		onError: (err) => alert(`Error: ${err.message}`),
	});

	const activeStream = displayUtterances.find((u) => u.state === "active");

	// useEffect for handling SSE with proper cleanup
	useEffect(() => {
		if (!activeStream) return;

		// Construct the URL to our new, dedicated SSE endpoint
		const url = `/api/chat-stream?intentionId=${activeStream.id}` as const;
		const eventSource = new EventSource(url);
		let isActive = true; // Flag to prevent state updates after cleanup

		eventSource.onmessage = (event) => {
			if (!isActive) return; // Prevent updates after cleanup

			const { type, data } = JSON.parse(event.data) as {
				type: "token" | "end" | "error";
				data?: string;
			};

			if (type === "token" && data) {
				setStreamingResponses((prev) => ({
					...prev,
					[activeStream.id]: (prev[activeStream.id] ?? "") + data,
				}));
			} else if (type === "end" || type === "error") {
				if (isActive) {
					utils.intention.getAllUtterancesInBeing.invalidate();
					setStreamingResponses((prev) => {
						const { [activeStream.id]: _, ...rest } = prev;
						return rest;
					});
				}
				eventSource.close();
			}
		};

		eventSource.onerror = (err) => {
			if (!isActive) return;
			chatLogger.error(err, "EventSource failed");
			eventSource.close();
			// No need to manually invalidate - the new state sync system handles this automatically!
		};

		// Cleanup on component unmount or when activeStream changes
		return () => {
			isActive = false; // Prevent any further state updates
			eventSource.close();
		};
	}, [activeStream, utils.intention.getAllUtterancesInBeing]);

	// IntersectionObserver to detect if the user is at the bottom
	useEffect(() => {
		const chatContainer = chatContainerRef.current;
		const bottomAnchor = bottomAnchorRef.current;

		if (!chatContainer || !bottomAnchor) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				setIsAtBottom(!!entry && entry.isIntersecting);
			},
			{ root: chatContainer, threshold: 0.1 }, // Observe within the chat container
		);

		observer.observe(bottomAnchor);

		return () => {
			observer.disconnect(); // Disconnect all observers to prevent memory leaks
		};
	}, []); // Remove deps to prevent recreation on every render

	// Auto-scroll to bottom if user is already at the bottom
	useLayoutEffect(() => {
		if (isAtBottom && bottomAnchorRef.current) {
			bottomAnchorRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [groupedMessages, isAtBottom]); // Re-run when new messages arrive or bottom status changes

	// Mount-time scroll to bottom to eliminate top-then-jump visual artifact
	useLayoutEffect(() => {
		if (chatContainerRef.current && typeof window !== "undefined") {
			const container = chatContainerRef.current;
			const originalScrollBehavior = container.style.scrollBehavior; // Store original

			// Temporarily set to 'auto' for instant scroll
			container.style.scrollBehavior = "auto";
			container.scrollTop = container.scrollHeight;

			// Restore original scroll-behavior after the first paint (or next tick)
			setTimeout(() => {
				container.style.scrollBehavior = originalScrollBehavior;
			}, 0);
		}
	}, []); // Empty dependency array to run only once on mount

	const scrollToBottom = () => {
		if (bottomAnchorRef.current) {
			bottomAnchorRef.current.scrollIntoView({ behavior: "smooth" });
		}
	};

	return (
		<ErrorBoundary>
			<div className="relative flex h-full w-full flex-col bg-white/20">
				{/* Top shadow overlay */}
				<div className="pointer-events-none absolute top-0 right-0 left-0 z-10 h-4 bg-gradient-to-b from-black/30 to-transparent" />
				<ul
					ref={chatContainerRef}
					className="flex grow flex-col gap-3 overflow-y-auto px-4 pt-4 pb-0 sm:px-6"
				>
					{groupedMessages.map((group, groupIndex) => {
						const isCurrentUser = group.ownerId === currentUserBeingId;
						// Special case for known AI agent, otherwise auto-detect
						const knownBeingType =
							group.ownerId === AI_AGENT_BEING_ID ? "bot" : undefined;
						const firstMessage = group.messages[0];
						const firstMessageTime = firstMessage
							? new Date(firstMessage.createdAt).toLocaleTimeString([], {
									hour: "2-digit",
									minute: "2-digit",
								})
							: "";

						return (
							<li
								key={groupIndex}
								className={`group flex items-end gap-2 ${isCurrentUser ? "flex-row-reverse" : ""}`}
							>
								<Avatar
									beingId={group.ownerId}
									beingType={knownBeingType}
									autoDetectType={!knownBeingType}
									size="sm"
								/>
								<div
									className={`flex w-full max-w-[75%] flex-col gap-0.5 ${isCurrentUser ? "items-end" : "items-start"}`}
								>
									<header
										className={`flex items-baseline gap-2 ${isCurrentUser ? "flex-row-reverse" : ""}`}
									>
										<span className="font-medium text-outline text-white">
											{beingNames[group.ownerId] || group.ownerId}
										</span>
										<time className="text-gray-500 text-outline text-xs dark:text-gray-400">
											{firstMessageTime}
										</time>
									</header>
									<div
										className={`flex flex-col gap-0.5 ${isCurrentUser ? "items-end" : "items-start"}`}
									>
										{group.messages.map((utt) => (
											<div
												key={utt.id}
												className={`rounded-2xl px-4 py-2 shadow ${isCurrentUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900 dark:bg-gray-700/60 dark:text-gray-50"}`}
											>
												<RichContent nodes={utt.content as ContentNode[]} />
												{utt.state === "active" && (
													<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
												)}
											</div>
										))}
									</div>
								</div>
							</li>
						);
					})}
					<li ref={bottomAnchorRef} className="h-px w-full" />{" "}
					{/* Invisible anchor */}
				</ul>
				{!isAtBottom && (
					<button
						onClick={scrollToBottom}
						className="absolute right-8 bottom-24 z-20 rounded-full bg-blue-500 p-3 text-white shadow-lg transition-all hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
						title="Jump to latest messages"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
							strokeWidth={1.5}
							stroke="currentColor"
							className="h-6 w-6"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"
							/>
						</svg>
					</button>
				)}
				{/* Bottom shadow overlay */}
				<div className="pointer-events-none absolute right-0 bottom-20 left-0 z-10 h-4 bg-gradient-to-t from-white/20 to-transparent" />
				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (message.trim()) {
							createUtterance.mutate({
								content: message,
								beingId: beingId,
							});
						}
					}}
					className="sticky bottom-0 flex w-full min-w-0 items-center gap-2 border-gray-200 border-t bg-white px-3 py-3 sm:px-4 dark:border-gray-800 dark:bg-gray-900"
				>
					<input
						type="text"
						placeholder="Say something..."
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						className="min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
					/>
					<button
						type="submit"
						className="shrink-0 rounded-full bg-blue-500 p-2 text-white transition hover:bg-blue-600 disabled:opacity-50"
						disabled={createUtterance.isPending}
						aria-label={
							createUtterance.isPending ? "Sending..." : "Send message"
						}
					>
						<Send className="size-4" />
					</button>
				</form>
			</div>
		</ErrorBoundary>
	);
}
