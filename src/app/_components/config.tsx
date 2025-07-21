// src/app/_components/config.tsx
"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "~/components/ui/button";
import ErrorBoundary from "~/components/ui/error-boundary";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";

export function Config() {
	const params = useParams();
	const beingId = params.beingId
		? decodeURIComponent(params.beingId as string)
		: undefined;

	const { data: allBeings, isLoading } = api.being.getAll.useQuery();

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

	const otherBeings = allBeings?.filter((b) => b.id !== beingId) || [];

	return (
		<ErrorBoundary>
			<div className="p-4">
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
				{otherBeings.length > 0 && (
					<>
						<h3 className="mb-2 font-semibold text-lg text-white">
							Other Beings:
						</h3>
						<ul>
							{otherBeings.map((being) => (
								<li
									key={being.id}
									className="flex items-center justify-between py-1"
								>
									<span className="text-white/80">
										{being.name || being.id}
									</span>
									<Link href={`/being/${being.id}/edit`}>
										<Button
											variant="ghost"
											size="icon"
											aria-label={`Edit ${being.name || being.id}`}
										>
											<Pencil className="size-5" />
										</Button>
									</Link>
								</li>
							))}
						</ul>
					</>
				)}
			</div>
		</ErrorBoundary>
	);
}
