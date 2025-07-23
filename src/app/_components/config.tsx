// src/app/_components/config.tsx
"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "~/components/ui/button";
import ErrorBoundary from "~/components/ui/error-boundary";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";
import { EntityCard } from "../../../packages/entity-kit/src/components/ui/EntityCard";
import type { BeingType, EntitySummary } from "../../../packages/entity-kit/src/types";

// Convert being to EntitySummary format
function toEntitySummary(being: { id: string; name: string; type: string }): EntitySummary {
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

	const { data: beingsInSpace, isLoading } = api.being.getByLocation.useQuery(
		{ locationId: beingId ?? "" },
		{ enabled: !!beingId }
	);

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

	return (
		<ErrorBoundary>
			<div className="flex h-full flex-col overflow-hidden">
				<div className="flex-1 overflow-y-auto p-4">
				<div className="flex items-center justify-between">
					<h3 className="font-semibold text-lg text-white">
						Current Space: {beingId}
					</h3>
					<Link href={`/being/${beingId}/edit`}>
						<Button variant="ghost" size="icon" aria-label="Edit Space">
							<Pencil className="size-5" />
						</Button>
					</Link>
				</div>
				<Separator className="my-4" />
				{beingsInSpace && beingsInSpace.length > 0 && (
					<>
						<h3 className="mb-2 font-semibold text-lg text-white">
							Beings in Space:
						</h3>
						<div className="space-y-2">
							{beingsInSpace.map((being) => (
								<div
									key={being.id}
									className="flex items-center gap-2"
								>
									<div className="flex-1 min-w-0">
										<EntityCard entity={toEntitySummary(being)} variant="compact" />
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
							))}
						</div>
					</>
				)}
				</div>
			</div>
		</ErrorBoundary>
	);
}
