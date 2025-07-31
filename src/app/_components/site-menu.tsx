// src/app/_components/site-menu.tsx
"use client";

import { ArrowRight, Plus } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { BeingCreateModal } from "~/components/being-create-modal";
import { BeingSelectField } from "~/components/being-selector";
import { PWAInstallButton } from "~/components/pwa-install-button";
import { Avatar } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import ErrorBoundary from "~/components/ui/error-boundary";
import { Separator } from "~/components/ui/separator";
import { useBeing } from "~/hooks/use-beings";
import type { BeingId } from "~/lib/types";

function NavigationSelector() {
	const router = useRouter();
	const [selectedBeing, setSelectedBeing] = useState<BeingId | "">("");

	const form = useForm({
		defaultValues: {
			beingId: "",
		},
	});

	const handleGoTo = () => {
		const beingId = form.getValues("beingId");
		if (beingId) {
			router.push(`/being/${beingId}`);
		}
	};

	return (
		<div>
			<FormProvider {...form}>
				<div className="flex items-center gap-2">
					<div className="flex-1">
						<BeingSelectField name="beingId" defaultTypeFilter="space" />
					</div>
					<Button
						onClick={handleGoTo}
						size="sm"
						className="h-16 w-10 p-0"
						disabled={!form.watch("beingId")}
					>
						<ArrowRight className="h-4 w-4" />
					</Button>
				</div>
			</FormProvider>
		</div>
	);
}

function UserCard() {
	const { data: session } = useSession();
	const currentUserBeingId = session?.user?.beingId;

	const { data: currentUserBeing } = useBeing(currentUserBeingId);

	if (!session || !currentUserBeing) {
		return null;
	}

	return (
		<div className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/5 p-3">
			<Avatar
				beingId={currentUserBeing.id as BeingId}
				beingType="guest"
				size="md"
				showSuperuserBadge={true}
			/>
			<div className="min-w-0 flex-1">
				<div className="truncate font-medium text-sm text-white">
					{currentUserBeing.name || session.user.name || "Unknown User"}
				</div>
				<div className="truncate text-white/60 text-xs">
					{session.user.email}
				</div>
			</div>
		</div>
	);
}

export function SiteMenu({ currentSpaceId }: { currentSpaceId?: BeingId }) {
	const router = useRouter();
	const { data: session } = useSession();
	const [isCreatingSpace, setIsCreatingSpace] = useState(false);

	const handleSpaceCreated = (spaceId: BeingId) => {
		console.log(
			"🐛 SiteMenu - handleSpaceCreated called with spaceId:",
			spaceId,
		);

		if (!spaceId) {
			console.error("🔥 SiteMenu - spaceId is undefined or empty!");
			return;
		}

		// Navigate to the newly created space
		console.log("🐛 SiteMenu - navigating to:", `/being/${spaceId}`);
		router.push(`/being/${spaceId}`);
	};

	return (
		<ErrorBoundary>
			<div className="flex h-full flex-col">
				<Separator className="bg-white/20" />
				<div className="p-4">
					<h3 className="mb-4 font-medium text-white/80">Navigate To</h3>
					<NavigationSelector />
				</div>
				<Separator className="bg-white/20" />
				<div className="p-4">
					<Button
						variant="outline"
						className="w-full gap-2 border-white/20 bg-transparent hover:bg-white/10"
						onClick={() => setIsCreatingSpace(true)}
					>
						<Plus className="h-4 w-4" />
						Create New Space
					</Button>
				</div>
				<div className="mt-auto space-y-4 p-4">
					<PWAInstallButton />
					<UserCard />
					<Button
						variant="outline"
						className="w-full border-white/20 bg-transparent hover:bg-white/10"
						onClick={async () => {
							console.log("🐛 Sign out button clicked");
							console.log("🐛 Current session:", session);

							// Check if this is a dev session (in development mode)
							// Dev sessions are identified by checking the cookie directly
							const isDevSession =
								process.env.NODE_ENV === "development" &&
								document.cookie.includes("authjs.session-token") &&
								document.cookie.match(/authjs\.session-token=dev-session-/);

							if (isDevSession) {
								console.log("🐛 Detected dev session, using dev logout...");
								try {
									const response = await fetch("/api/auth/dev-logout", {
										method: "POST",
									});

									if (response.ok) {
										console.log("🐛 Dev logout successful, redirecting...");
										window.location.href = "/auth/signin";
										return;
									}
									console.error("🔥 Dev logout failed:", response.status);
								} catch (error) {
									console.error("🔥 Dev logout error:", error);
								}
							}

							// Force logout by clearing client-side session and redirecting
							console.log(
								"🐛 Force logging out - clearing session and redirecting...",
							);

							// Clear all auth-related cookies
							const cookies = document.cookie.split(";");
							for (const c of cookies) {
								document.cookie = c
									.replace(/^ +/, "")
									.replace(
										/=.*/,
										`=;expires=${new Date().toUTCString()};path=/`,
									);
							}

							// Clear localStorage and sessionStorage
							localStorage.clear();
							sessionStorage.clear();

							console.log("🐛 Attempting hard reload to force logout...");
							// Force a hard reload to completely reset the app state
							window.location.reload();
						}}
					>
						Sign Out
					</Button>
				</div>
			</div>

			{/* Create New Space Modal */}
			<BeingCreateModal
				isOpen={isCreatingSpace}
				onClose={() => setIsCreatingSpace(false)}
				onCreated={handleSpaceCreated}
				defaultValues={{
					type: "space",
				}}
			/>
		</ErrorBoundary>
	);
}
