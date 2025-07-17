import { Suspense } from "react";
import { Chat } from "~/app/_components/chat";
import { auth } from "~/server/auth";
import { HydrateClient, api } from "~/trpc/server";

export default async function SpacePage({ params }: { params: Promise<{ beingId: string }> }) {
  const session = await auth();
  const { beingId: encodedBeingId } = await params;
  const beingId = decodeURIComponent(encodedBeingId);

  if (session?.user) {
    void api.intention.getAllUtterancesInSpace.prefetch({ spaceId: beingId });
    // Prefetch beings for the site menu
    void api.being.getAll.prefetch();
  }

  return (
    <HydrateClient>
      <div className="container flex flex-col items-center justify-center p-4">
        {session?.user?.beingId ? (
          <Suspense fallback={<ChatLoading />}>
            <Chat currentUserBeingId={session.user.beingId} spaceId={beingId} />
          </Suspense>
        ) : (
          <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
            <p className="text-xl text-white/70">
              {session?.user ? "Initializing your being..." : "Please sign in to join the space."}
            </p>
          </div>
        )}
      </div>
    </HydrateClient>
  );
}

function ChatLoading() {
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-3xl h-full">
        <p>Loading Chat...</p>
    </div>
  );
}