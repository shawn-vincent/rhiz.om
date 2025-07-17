// src/app/_components/chat.tsx
"use client";

import { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";
import { RichContent } from "~/app/_components/rich-content";
import { type ContentNode } from "~/server/db/content-types";
import superjson from "superjson";


const AI_AGENT_BEING_ID = "@rhiz.om-assistant";

type Utterance = RouterOutputs["intention"]["getAllUtterancesInSpace"][number];

interface ChatProps {
  currentUserBeingId: string;
  spaceId: string;
}

export function Chat({ currentUserBeingId, spaceId }: ChatProps) {
  const [message, setMessage] = useState("");
  const [streamingResponses, setStreamingResponses] = useState<Record<string, string>>({});
  const [isAtBottom, setIsAtBottom] = useState(true); // State to track if user is at the bottom

  const chatContainerRef = useRef<HTMLUListElement>(null); // Ref for the scrollable chat container
  const bottomAnchorRef = useRef<HTMLLIElement>(null); // Ref for the invisible anchor at the bottom
  
  const utils = api.useUtils();
  const [utterances] = api.intention.getAllUtterancesInSpace.useSuspenseQuery(
    { spaceId },
    { staleTime: 0 }
  );

  const groupedMessages = useMemo(() => {
    // This logic remains the same and will work with the streaming updates
    const combinedUtterances = utterances.map(utt => {
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
      await utils.intention.getAllUtterancesInSpace.invalidate();
      
      if (data.aiIntentionId) {
        setStreamingResponses(prev => ({ ...prev, [data.aiIntentionId]: "" }));
      }
    },
    onError: (err) => alert(`Error: ${err.message}`),
  });

  const activeStream = utterances.find(u => u.state === 'active');
  
  // useEffect for handling SSE
  useEffect(() => {
    if (!activeStream) return;

    // Construct the URL to our new, dedicated SSE endpoint
    const url = `/api/chat-stream?intentionId=${activeStream.id}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data) as { type: 'token' | 'end' | 'error', data?: string };

      if (type === 'token' && data) {
        setStreamingResponses(prev => ({
          ...prev,
          [activeStream.id]: (prev[activeStream.id] ?? "") + data,
        }));
      } else if (type === 'end' || type === 'error') {
        utils.intention.getAllUtterancesInSpace.invalidate();
        setStreamingResponses(prev => {
          const { [activeStream.id]: _, ...rest } = prev;
          return rest;
        });
        eventSource.close();
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      eventSource.close();
      // Invalidate to fetch the final 'failed' state from the DB if an error occurs
      utils.intention.getAllUtterancesInSpace.invalidate();
    };

    // Cleanup on component unmount or when activeStream changes
    return () => {
      eventSource.close();
    };
  }, [activeStream, utils.intention.getAllUtterancesInSpace]);

  // IntersectionObserver to detect if the user is at the bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(!!entry && entry.isIntersecting);
      },
      { root: chatContainerRef.current, threshold: 0.1 } // Observe within the chat container
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

  const scrollToBottom = () => {
    if (bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full max-w-3xl flex-col rounded-lg border border-white/20 bg-white/5 p-4 shadow-lg">
      
      <ul ref={chatContainerRef} className="flex grow flex-col gap-3 overflow-y-auto">
        {groupedMessages.map((group, groupIndex) => {
            const isCurrentUser = group.ownerId === currentUserBeingId;
            const avatarSrc = group.ownerId === AI_AGENT_BEING_ID 
              ? `https://i.pravatar.cc/40?u=ai` 
              : `https://i.pravatar.cc/40?u=${group.ownerId}`;
            const firstMessageTime = new Date(group.messages[0]!.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <li key={groupIndex} className={`flex items-end gap-2 group ${isCurrentUser ? "flex-row-reverse" : ""}`}>
                <img src={avatarSrc} className="h-8 w-8 rounded-full" alt={group.ownerId} />
                <div className={`flex flex-col gap-0.5 w-full max-w-[75%] ${isCurrentUser ? "items-end" : "items-start"}`}>
                  <header className={`flex items-baseline gap-2 ${isCurrentUser ? "flex-row-reverse" : ""}`}>
                    <span className="font-medium text-gray-900 dark:text-gray-50">{group.ownerId}</span>
                    <time className="text-xs text-gray-500 dark:text-gray-400">{firstMessageTime}</time>
                  </header>
                  <div className={`flex flex-col gap-0.5 ${isCurrentUser ? "items-end" : "items-start"}`}>
                    {group.messages.map((utt) => (
                      <div key={utt.id} className={`px-4 py-2 rounded-2xl shadow ${isCurrentUser ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-900 dark:bg-gray-700/60 dark:text-gray-50"}`}>
                        <RichContent nodes={utt.content as ContentNode[]} />
                        {utt.state === 'active' && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-current"></span>}
                      </div>
                    ))}
                  </div>
                </div>
              </li>
            );
        })}
        <li ref={bottomAnchorRef} className="h-px w-full"></li> {/* Invisible anchor */}
      </ul>
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-8 z-20 rounded-full bg-blue-500 p-3 text-white shadow-lg transition-all hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
          title="Jump to latest messages"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
          </svg>
        </button>
      )}
       <form
        onSubmit={(e) => {
          e.preventDefault();
          if (message.trim()) {
            createUtterance.mutate({
              content: message,
              spaceId,
            });
          }
        }}
        className="sticky bottom-0 mt-4 flex w-full items-center gap-2 rounded-md border-t border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900"
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
  );
}