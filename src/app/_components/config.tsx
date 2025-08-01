// src/app/_components/config.tsx
"use client";

import { Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BeingCreateModal } from "~/components/being-create-modal";
import { BeingEditModal } from "~/components/being-edit-modal";
import { Button } from "~/components/ui/button";
import ErrorBoundary from "~/components/ui/error-boundary";
import { Separator } from "~/components/ui/separator";
import { useSync } from "~/hooks/use-sync";
import { canEdit, isSuperuser } from "~/lib/permissions";
import { type BeingId, isBeingId } from "~/lib/types";
import { api } from "~/trpc/react";
import { EntityCard } from "../../../packages/entity-kit/src/components/ui/EntityCard";
import type {
	BeingType,
	EntitySummary,
} from "../../../packages/entity-kit/src/types";

// Convert being to EntitySummary format
function toEntitySummary(being: {
	id: BeingId;
	name: string;
	type: string;
}): EntitySummary {
	return {
		id: being.id,
		name: being.name,
		type: being.type as BeingType,
	};
}

export function Config() {
	const params = useParams();
	const beingId: BeingId | undefined = params.beingId
		? (() => {
				const decoded = decodeURIComponent(params.beingId as string);
				return isBeingId(decoded) ? decoded : undefined;
			})()
		: undefined;

	const { data: session } = useSession();
	const currentUserBeingId = session?.user?.beingId;

	const [selectedBeingId, setSelectedBeingId] = useState<BeingId | null>(null);
	const [editingBeingId, setEditingBeingId] = useState<BeingId | null>(null);
	const [isCreatingBeing, setIsCreatingBeing] = useState(false);

	// Fetch current user's being to check superuser status
	const { data: currentUserBeing } = api.being.getById.useQuery(
		{ id: currentUserBeingId ?? "" },
		{ enabled: !!currentUserBeingId },
	);
	const isCurrentUserSuperuser = isSuperuser(currentUserBeing);

	const { data: currentSpace, isLoading: isLoadingCurrentSpace } =
		api.being.getById.useQuery({ id: beingId ?? "" }, { enabled: !!beingId });

	// Get all beings and filter to current space
	const { data: allBeings, isLoading: isLoadingBeings } =
		api.being.getAll.useQuery(undefined);

	// Filter beings to current space
	const beingsInSpace = allBeings
		? allBeings.filter((b) => b.locationId === beingId)
		: [];

	// Create presence map (no real presence tracking - just show all beings)
	const presenceMap = new Map<string, boolean>(
		beingsInSpace.map((being) => [being.id, true] as const),
	);

	const isLoading = isLoadingCurrentSpace || isLoadingBeings;

	// Check if current user can edit - now uses permission utility
	const canEditBeing = (ownerId: unknown) => {
		return canEdit(
			currentUserBeingId,
			ownerId as BeingId | null | undefined,
			isCurrentUserSuperuser,
		);
	};

	const canCreateInSpace = currentSpace && canEditBeing(currentSpace.ownerId);

	if (!beingId) {
		return (
			<div className="p-4 text-center text-white/70">No being selected.</div>
		);
	}

	if (isLoading) {
		return (
			<div className="p-4 text-center text-white/70">Loading beings...</div>
		);
	}

	// Get beings in space and sort them consistently
	const otherBeingsInSpace = beingsInSpace.filter((b) => b.id !== beingId);

	// Separate and order beings: spaces/bots first, then connected guests, then disconnected
	const spacesAndBots = otherBeingsInSpace.filter(
		(b) => b.type === "space" || b.type === "bot",
	);
	const connectedGuests = otherBeingsInSpace.filter(
		(b) => b.type === "guest" && presenceMap.get(b.id),
	);
	const disconnectedGuests = otherBeingsInSpace.filter(
		(b) => b.type === "guest" && !presenceMap.get(b.id),
	);

	const orderedBeings = [
		...spacesAndBots,
		...connectedGuests,
		...disconnectedGuests,
	];

	return (
		<ErrorBoundary>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="flex-1 overflow-y-auto p-4">
					{currentSpace && (
						<div className="mb-4 flex items-center justify-between">
							<div className="min-w-0 flex-1">
								<EntityCard
									entity={toEntitySummary(currentSpace as any)}
									variant="default"
									onClick={() => setSelectedBeingId(currentSpace.id as BeingId)}
									onEdit={
										canEditBeing(currentSpace.ownerId)
											? () => setEditingBeingId(currentSpace.id as BeingId)
											: undefined
									}
									isSelected={selectedBeingId === currentSpace.id}
									showEditButton={
										!!(
											selectedBeingId === currentSpace.id &&
											canEditBeing(currentSpace.ownerId)
										)
									}
								/>
							</div>
						</div>
					)}

					<div className="mb-2 flex items-center justify-between">
						<h3 className="font-semibold text-lg text-white">
							Beings in Space
						</h3>
						{canCreateInSpace && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsCreatingBeing(true)}
								className="gap-2"
							>
								<Plus className="h-4 w-4" />
								Add
							</Button>
						)}
					</div>

					<Separator className="my-4" />

					{orderedBeings.length > 0 ? (
						<div className="space-y-2">
							{orderedBeings.map((being) => {
								const isOnline = presenceMap.get(being.id) ?? false;

								return (
									<EntityCard
										key={being.id}
										entity={toEntitySummary(being as any)}
										variant="default"
										isOnline={isOnline}
										onClick={() => setSelectedBeingId(being.id as BeingId)}
										onEdit={
											canEditBeing(being.ownerId)
												? () => setEditingBeingId(being.id as BeingId)
												: undefined
										}
										isSelected={selectedBeingId === being.id}
										showEditButton={
											!!(
												selectedBeingId === being.id &&
												canEditBeing(being.ownerId)
											)
										}
									/>
								);
							})}
						</div>
					) : (
						<div className="py-8 text-center text-muted-foreground">
							<p>No beings in this space yet.</p>
							{canCreateInSpace && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => setIsCreatingBeing(true)}
									className="mt-4 gap-2"
								>
									<Plus className="h-4 w-4" />
									Add your first being
								</Button>
							)}
						</div>
					)}
				</div>
			</div>

			{/* Edit modal */}
			<BeingEditModal
				beingId={editingBeingId}
				isOpen={!!editingBeingId}
				onClose={() => setEditingBeingId(null)}
			/>

			{/* Create modal for adding beings to space */}
			<BeingCreateModal
				isOpen={isCreatingBeing}
				onClose={() => setIsCreatingBeing(false)}
				defaultValues={{
					type: "bot",
					locationId: beingId,
				}}
			/>
		</ErrorBoundary>
	);
}
