// src/app/_components/config.tsx
"use client";

import { useParams } from "next/navigation";
import ErrorBoundary from "~/components/ui/error-boundary";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";
import { BeingEditorModal } from "./being-editor-modal";

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
					<BeingEditorModal beingId={beingId} title="Edit Space" />
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
									<BeingEditorModal beingId={being.id} title="Edit Being" />
								</li>
							))}
						</ul>
					</>
				)}
			</div>
		</ErrorBoundary>
	);
}
