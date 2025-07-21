import { Suspense } from "react";
import { BeingBackground } from "~/app/_components/being-background";
import { BottomBar } from "~/app/_components/bottom-bar";
import { Chat } from "~/app/_components/chat";
import { TopBar } from "~/app/_components/top-bar";
import ErrorBoundary from "~/components/ui/error-boundary";
import { auth } from "~/server/auth";
import { HydrateClient, api } from "~/trpc/server";

export default async function SpacePage({
	params,
}: { params: Promise<{ beingId: string }> }) {
	const session = await auth();
	const { beingId: encodedBeingId } = await params;
	const beingId = decodeURIComponent(encodedBeingId);

	if (session?.user) {
		void api.intention.getAllUtterancesInBeing.prefetch({ beingId: beingId });
		// Prefetch beings for the site menu
		void api.being.getAll.prefetch();
	}

	return (
		<HydrateClient>
			<div className="grid h-dvh grid-rows-[auto_1fr_auto] bg-black text-white">
				<TopBar session={session} />
				<ErrorBoundary>
					<main className="relative overflow-y-auto">
						<BeingBackground />
						<div className="container relative z-10 flex h-full flex-col items-center justify-center p-4">
							{session?.user?.beingId ? (
								<Suspense fallback={<ChatLoading />}>
									<Chat
										currentUserBeingId={session.user.beingId}
										beingId={beingId}
									/>
								</Suspense>
							) : (
								<div className="flex h-[calc(100vh-10rem)] items-center justify-center">
									<p className="text-white/70 text-xl">
										{session?.user
											? "Initializing your being..."
											: "Please sign in to join the being."}
									</p>
								</div>
							)}
						</div>
					</main>
				</ErrorBoundary>
				{session && <BottomBar />}
			</div>
		</HydrateClient>
	);
}

function ChatLoading() {
	return (
		<div className="flex h-full w-full max-w-3xl flex-col items-center justify-center">
			<p>Loading Chat...</p>
		</div>
	);
}
