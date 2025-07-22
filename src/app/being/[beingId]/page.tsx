import { Suspense } from "react";
import { BeingBackground } from "~/app/_components/being-background";
import { BottomBar } from "~/app/_components/bottom-bar";
import { Chat } from "~/app/_components/chat";
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
			<div className="grid h-dvh grid-rows-[1fr_auto] overflow-hidden bg-black text-white">
				<ErrorBoundary>
					<main className="relative overflow-hidden">
						<BeingBackground />
						<div className="relative z-10 flex h-full justify-center">
							<div className="w-full max-w-2xl">
								{session?.user?.beingId ? (
									<Suspense fallback={<ChatLoading />}>
										<Chat
											currentUserBeingId={session.user.beingId}
											beingId={beingId}
										/>
									</Suspense>
								) : (
									<div className="flex h-full items-center justify-center">
										<p className="text-white/70 text-xl">
											{session?.user
												? "Initializing your being..."
												: "Please sign in to join the being."}
										</p>
									</div>
								)}
							</div>
						</div>
					</main>
				</ErrorBoundary>
				<BottomBar session={session} />
			</div>
		</HydrateClient>
	);
}

function ChatLoading() {
	return (
		<div className="flex h-full w-full flex-col items-center justify-center">
			<p>Loading Chat...</p>
		</div>
	);
}
