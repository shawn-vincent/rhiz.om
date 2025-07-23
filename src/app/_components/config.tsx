// src/app/_components/config.tsx
"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "~/components/ui/button";
import ErrorBoundary from "~/components/ui/error-boundary";
import { Separator } from "~/components/ui/separator";
import { useSpacePresence } from "~/hooks/use-state-sync";
import type { BeingId } from "~/server/db/types";
import { api } from "~/trpc/react";
import { EntityCard } from "../../../packages/entity-kit/src/components/ui/EntityCard";
import type {
	BeingType,
	EntitySummary,
} from "../../../packages/entity-kit/src/types";

// Convert being to EntitySummary format
function toEntitySummary(being: {
	id: string;
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
	const beingId = params.beingId
		? decodeURIComponent(params.beingId as string)
		: undefined;

	const { data: currentSpace, isLoading: isLoadingCurrentSpace } =
		api.being.getById.useQuery({ id: beingId ?? "" }, { enabled: !!beingId });

	const { data: beingsInSpace, isLoading: isLoadingBeings } =
		api.being.getByLocation.useQuery(
			{ locationId: beingId ?? "" },
			{ enabled: !!beingId },
		);

	const { presence, onlineBeings } = useSpacePresence(
		beingId ? (beingId as BeingId) : ("" as BeingId),
	);
	const presenceMap = new Map(
		presence?.beings.map((p) => [
			p.being.id,
			p.connectionStatus === "online",
		]) ?? [],
	);

	const isLoading = isLoadingCurrentSpace || isLoadingBeings;

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
	const otherBeingsInSpace =
		beingsInSpace?.filter((b) => b.id !== beingId) ?? [];

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
						<div className="flex items-center justify-between">
							<div className="min-w-0 flex-1">
								<EntityCard
									entity={toEntitySummary(currentSpace)}
									variant="default"
								/>
							</div>
							<Link href={`/being/${beingId}/edit`}>
								<Button variant="ghost" size="icon" aria-label="Edit Space">
									<Pencil className="size-5" />
								</Button>
							</Link>
						</div>
					)}
					<Separator className="my-4" />
					{orderedBeings.length > 0 && (
						<>
							<h3 className="mb-2 font-semibold text-lg text-white">
								Beings in Space:
							</h3>
							<div className="space-y-2">
								{orderedBeings.map((being) => {
									const isSpace =
										being.type === "space" || being.type === "bot";
									const isOnline = isSpace || presenceMap.get(being.id);

									return (
										<div key={being.id} className="flex items-center gap-2">
											<div className="min-w-0 flex-1">
												<EntityCard
													entity={toEntitySummary(being)}
													variant="default"
													isOnline={isOnline}
												/>
											</div>
											<Link href={`/being/${being.id}/edit`}>
												<Button
													variant="ghost"
													size="icon"
													aria-label={`Edit ${being.name || being.id}`}
												>
													<Pencil className="size-5" />
												</Button>
											</Link>
										</div>
									);
								})}
							</div>
						</>
					)}
				</div>
			</div>
		</ErrorBoundary>
	);
}
