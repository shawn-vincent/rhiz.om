// src/app/_components/site-menu.tsx
"use client";

import { ArrowRight, Plus } from "lucide-react";
import { useSession } from "next-auth/react";
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
import { api } from "~/trpc/react";

function NavigationSelector() {
	const router = useRouter();
	const [selectedBeing, setSelectedBeing] = useState<string>("");

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

	const { data: currentUserBeing } = api.being.getById.useQuery(
		{ id: currentUserBeingId ?? "" },
		{ enabled: !!currentUserBeingId },
	);

	if (!session || !currentUserBeing) {
		return null;
	}

	return (
		<div className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/5 p-3">
			<Avatar
				beingId={currentUserBeing.id}
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

export function SiteMenu() {
	const router = useRouter();
	const [isCreatingSpace, setIsCreatingSpace] = useState(false);

	const handleSpaceCreated = (spaceId: string) => {
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
						onClick={() => {
							window.location.href = "/api/auth/signout";
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
