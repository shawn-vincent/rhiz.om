// src/app/_components/chat.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";
import { RichContent } from "~/app/_components/rich-content";
import { type ContentNode } from "~/server/db/content-types";
import superjson from "superjson";

const FAKE_SPACE_ID = "@my-personal-space";
const AI_AGENT_BEING_ID = "@rhiz.om-assistant";

type Utterance = RouterOutputs["intention"]["getAllUtterancesInSpace"][number];

interface ChatProps {
  currentUserBeingId: string;
}

export function Chat({ currentUserBeingId }: ChatProps) {
  const [message, setMessage] = useState("");
  const [streamingResponses, setStreamingResponses] = useState<Record<string, string>>({});
  
  const utils = api.useUtils();
  const [utterances] = api.intention.getAllUtterancesInSpace.useSuspenseQuery(
    { spaceId: FAKE_SPACE_ID },
    { staleTime: 0 }
  );

  const createUtterance = api.intention.createUtterance.useMutation({
    onSuccess: async (data) => {
      setMessage("");
      await utils.intention.getAllUtterancesInSpace.invalidate();
      
      // The new AI intention ID is available here if needed for state tracking
      if (data.aiIntentionId) {
        setStreamingResponses(prev => ({ ...prev, [data.aiIntentionId]: "" }));
      }
    },
    onError: (err) => alert(`Error: ${err.message}`),
  });

  const activeStream = utterances.find(u => u.state === 'active');
  
  // NEW: useEffect for handling SSE
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
      // Optionally invalidate data to show the 'failed' state from the DB
      utils.intention.getAllUtterancesInSpace.invalidate();
    };

    // Cleanup on component unmount or when activeStream changes
    return () => {
      eventSource.close();
    };
  }, [activeStream, utils.intention.getAllUtterancesInSpace]);

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

  // The rest of the component's JSX remains the same
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full max-w-3xl flex-col rounded-lg border border-white/20 bg-white/5 p-4 shadow-lg">
      <div className="sticky top-0 z-10 mb-4 rounded-md bg-white/70 p-2 backdrop-blur dark:bg-gray-900/70">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Chat Space: {FAKE_SPACE_ID}
        </h2>
      </div>
      <ul className="flex grow flex-col gap-3 overflow-y-auto">
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
      </ul>
       <form
        onSubmit={(e) => {
          e.preventDefault();
          if (message.trim()) {
            createUtterance.mutate({
              content: message,
              spaceId: FAKE_SPACE_ID,
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
