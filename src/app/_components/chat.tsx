// src/app/_components/chat.tsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import superjson from "superjson";
import { RichContent } from "~/app/_components/rich-content";
import ErrorBoundary from "~/components/ui/error-boundary";
import { Avatar } from "~/components/ui/avatar";
import type { ContentNode } from "~/server/db/content-types";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";
import { logger } from "~/lib/logger.client";

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
	const [utterances] = api.intention.getAllUtterancesInBeing.useSuspenseQuery(
		{ beingId },
		{ staleTime: 0 },
	);

	const groupedMessages = useMemo(() => {
		// This logic remains the same and will work with the streaming updates
		const combinedUtterances = utterances.map((utt) => {
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
	}, [utterances, streamingResponses]);

	const createUtterance = api.intention.createUtterance.useMutation({
		onSuccess: async (data) => {
			setMessage("");
			await utils.intention.getAllUtterancesInBeing.invalidate();

			if (data.aiIntentionId) {
				setStreamingResponses((prev) => ({
					...prev,
					[data.aiIntentionId]: "",
				}));
			}
		},
		onError: (err) => alert(`Error: ${err.message}`),
	});

	const activeStream = utterances.find((u) => u.state === "active");

	// useEffect for handling SSE
	useEffect(() => {
		if (!activeStream) return;

		// Construct the URL to our new, dedicated SSE endpoint
		const url = `/api/chat-stream?intentionId=${activeStream.id}` as const;
		const eventSource = new EventSource(url);

		eventSource.onmessage = (event) => {
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
				utils.intention.getAllUtterancesInBeing.invalidate();
				setStreamingResponses((prev) => {
					const { [activeStream.id]: _, ...rest } = prev;
					return rest;
				});
				eventSource.close();
			}
		};

		eventSource.onerror = (err) => {
			chatLogger.error(err, "EventSource failed");
			eventSource.close();
			// Invalidate to fetch the final 'failed' state from the DB if an error occurs
			utils.intention.getAllUtterancesInBeing.invalidate();
		};

		// Cleanup on component unmount or when activeStream changes
		return () => {
			eventSource.close();
		};
	}, [activeStream, utils.intention.getAllUtterancesInBeing]);

	// IntersectionObserver to detect if the user is at the bottom
	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				setIsAtBottom(!!entry && entry.isIntersecting);
			},
			{ root: chatContainerRef.current, threshold: 0.1 }, // Observe within the chat container
		);

		if (bottomAnchorRef.current) {
			observer.observe(bottomAnchorRef.current);
		}

		return () => {
			if (bottomAnchorRef.current) {
				observer.unobserve(bottomAnchorRef.current);
			}
		};
	}, [chatContainerRef, bottomAnchorRef]);

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
			<div className="relative flex h-full w-full max-w-3xl flex-col rounded-lg border border-white/20 bg-white/20 p-4 pt-0 shadow-lg ring-1 ring-white/25 backdrop-blur-md">
				<ul
					ref={chatContainerRef}
					className="flex grow flex-col gap-3 overflow-y-auto"
				>
					{groupedMessages.map((group, groupIndex) => {
						const isCurrentUser = group.ownerId === currentUserBeingId;
						// Special case for known AI agent, otherwise auto-detect
						const knownBeingType = group.ownerId === AI_AGENT_BEING_ID ? "bot" : undefined;
						const firstMessageTime = new Date(
							group.messages[0]!.createdAt,
						).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
										<span className="font-medium text-gray-900 dark:text-gray-50">
											{group.ownerId}
										</span>
										<time className="text-gray-500 text-xs dark:text-gray-400">
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
													<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current"></span>
												)}
											</div>
										))}
									</div>
								</div>
							</li>
						);
					})}
					<li ref={bottomAnchorRef} className="h-px w-full"></li>{" "}
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
					className="sticky bottom-0 mt-4 flex w-full items-center gap-2 rounded-md border-gray-200 border-t bg-white p-2 dark:border-gray-800 dark:bg-gray-900"
				>
					<input
						type="text"
						placeholder="Say something..."
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						className="w-full flex-grow rounded-full border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
					/>
					<button
						type="submit"
						className="rounded-full bg-blue-500 px-6 py-2 font-semibold text-white transition hover:bg-blue-600"
						disabled={createUtterance.isPending}
					>
						{createUtterance.isPending ? "Sending..." : "Send"}
					</button>
				</form>
			</div>
		</ErrorBoundary>
	);
}
