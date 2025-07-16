import Link from "next/link";

import { Chat } from "~/app/_components/chat";
import { auth } from "~/server/auth";
import { HydrateClient, api } from "~/trpc/server";

export default async function Home() {
  const session = await auth();
  const FAKE_SPACE_ID = "@my-personal-space";

  // Prefetch the utterances if the user is logged in
  if (session?.user) {
    void api.intention.getAllUtterancesInSpace.prefetch({
      spaceId: FAKE_SPACE_ID,
    });
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="font-extrabold text-5xl tracking-tight sm:text-[5rem]">
            Rhiz<span className="text-[hsl(280,100%,70%)]">.om</span>
          </h1>

          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center text-2xl text-white">
                {session && <span>Logged in as {session.user?.name}</span>}
              </p>
              <Link
                href={session ? "/api/auth/signout" : "/api/auth/signin"}
                className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
              >
                {session ? "Sign out" : "Sign in"}
              </Link>
            </div>
          </div>

          {session?.user?.beingId ? (
            <Chat currentUserBeingId={session.user.beingId} />
          ) : (
            <p className="text-xl text-white/70">
              {session?.user ? "Initializing your being, please wait..." : "Please sign in to join the space."}
            </p>
          )}
        </div>
      </main>
    </HydrateClient>
  );
}