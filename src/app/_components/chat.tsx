"use client";

import { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/react";

// A hardcoded spaceId for demonstration purposes.
// In a real app, this would come from the URL or other context.
const FAKE_SPACE_ID = " @my-personal-space";

type Utterance = RouterOutputs["intention"]["getAllUtterancesInSpace"][number];

interface ChatProps {
  currentUserBeingId: string;
}

export function Chat({ currentUserBeingId }: ChatProps) {
  // Query for all utterances in our hardcoded space
  const [utterances] =
    api.intention.getAllUtterancesInSpace.useSuspenseQuery({
      spaceId: FAKE_SPACE_ID,
    });

  const utils = api.useUtils();
  const [message, setMessage] = useState("");

  // tRPC mutation to create a new utterance
  const createUtterance = api.intention.createUtterance.useMutation({
    onSuccess: async () => {
      // On success, invalidate the query to refetch the messages
      await utils.intention.getAllUtterancesInSpace.invalidate();
      setMessage("");
    },
    onError: (err) => {
      // Simple alert for errors
      alert(`Error: ${err.message}`);
    },
  });

  const groupedMessages = useMemo(() => {
    const groups: Array<{ ownerId: string; messages: Utterance[] }> = [];
    let currentGroup: { ownerId: string; messages: Utterance[] } | null = null;

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

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full max-w-3xl flex-col rounded-lg border border-white/20 bg-white/5 p-4 shadow-lg">
      {/* Header - Placeholder for now */}
      <div className="sticky top-0 z-10 mb-4 rounded-md bg-white/70 p-2 backdrop-blur dark:bg-gray-900/70">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Chat Space: {FAKE_SPACE_ID}
        </h2>
      </div>

      {/* Message List */}
      <ul className="flex grow flex-col gap-3 overflow-y-auto">
        {groupedMessages.length > 0 ? (
          groupedMessages.map((group, groupIndex) => {
            const isCurrentUser = group.ownerId === currentUserBeingId;
            const avatarSrc = `https://i.pravatar.cc/40?u=${group.ownerId}`;
            const firstMessageTime = new Date(group.messages[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <li
                key={groupIndex}
                className={`flex items-end gap-2 group ${isCurrentUser ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <img
                  src={avatarSrc}
                  className="h-8 w-8 rounded-full"
                  alt={group.ownerId}
                />
                {/* Bubble Column */}
                <div className={`flex flex-col gap-0.5 w-full max-w-[75%] ${isCurrentUser ? "items-end" : "items-start"}`}>
                  <header className={`flex items-baseline gap-2 ${isCurrentUser ? "flex-row-reverse" : ""}`}>
                    <span className="font-medium text-gray-900 dark:text-gray-50">
                      {group.ownerId}
                    </span>
                    <time className="text-xs text-gray-500 dark:text-gray-400">
                      {firstMessageTime}
                    </time>
                  </header>

                  {/* Bubbles */}
                  <div className={`flex flex-col gap-0.5 ${isCurrentUser ? "items-end" : "items-start"}`}>
                    {group.messages.map((utt) => (
                      <p
                        key={utt.id}
                        className={`px-4 py-2 rounded-2xl shadow ${
                          isCurrentUser
                            ? "bg-blue-500 text-white"
                            : "bg-gray-100 text-gray-900 dark:bg-gray-700/60 dark:text-gray-50"
                        }`}
                      >
                        {JSON.stringify(utt.content)}
                      </p>
                    ))}
                  </div>
                </div>
              </li>
            );
          })
        ) : (
          <p className="text-center text-white/70">
            No messages yet. Be the first to say something!
          </p>
        )}
      </ul>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createUtterance.mutate({
            content: message,
            spaceId: FAKE_SPACE_ID,
          });
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
