"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

// A hardcoded spaceId for demonstration purposes.
// In a real app, this would come from the URL or other context.
const FAKE_SPACE_ID = "@my-personal-space";

export function Chat() {
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

  return (
    <div className="w-full max-w-md border border-white/20 rounded-lg p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-2 h-64 overflow-y-auto">
        {utterances.length > 0 ? (
          utterances.map((utt) => (
            <div key={utt.id} className="truncate">
              <strong>{utt.ownerId}:</strong> {JSON.stringify(utt.content)}
            </div>
          ))
        ) : (
          <p>No messages yet. Be the first to say something!</p>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createUtterance.mutate({
            content: message,
            spaceId: FAKE_SPACE_ID,
          });
        }}
        className="flex flex-col gap-2"
      >
        <input
          type="text"
          placeholder="Say something..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-full bg-white/10 px-4 py-2 text-white"
        />
        <button
          type="submit"
          className="rounded-full bg-white/10 px-10 py-3 font-semibold transition hover:bg-white/20"
          disabled={createUtterance.isPending}
        >
          {createUtterance.isPending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}