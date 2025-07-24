// src/components/inline-being-name.tsx
"use client";

import { useParams } from "next/navigation";
import { InlineText } from "~/components/ui/inline-editable";
import { logger } from "~/lib/logger.client";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useBeing } from "~/hooks/use-being-cache";

const inlineBeingLogger = logger.child({ name: "InlineBeingName" });

interface InlineBeingNameProps {
	fallback?: string;
	className?: string;
	readOnly?: boolean;
}

export function InlineBeingName({
	fallback = "Rhiz.om",
	className,
	readOnly = false,
}: InlineBeingNameProps) {
	const params = useParams();
	const beingId = params.beingId
		? decodeURIComponent(params.beingId as string)
		: undefined;

	const utils = api.useUtils();

	const { data: being, error: beingError } = useBeing(beingId);

	const upsertBeing = api.being.upsert.useMutation({
		onSuccess: async () => {
			await utils.being.getById.invalidate({ id: beingId as string });
			await utils.being.getAll.invalidate();
		},
		onError: (err) => {
			inlineBeingLogger.error(
				err,
				`Failed to update being name: ${err.message}`,
			);
		},
	});

	const handleSave = async (newName: string) => {
		if (!being || !beingId) return;

		await upsertBeing.mutate({
			...being,
			name: newName,
			ownerId: being.ownerId ?? undefined,
			locationId: being.locationId ?? undefined,
			extIds: being.extIds ?? undefined,
			idHistory: being.idHistory ?? undefined,
			metadata: being.metadata ?? undefined,
			properties: being.properties ?? undefined,
			content: being.content ?? undefined,
			botModel: being.botModel ?? undefined,
			botPrompt: being.botPrompt ?? undefined,
		});
	};

	// If no beingId, show static fallback
	if (!beingId) {
		return (
			<h1
				className={cn(
					"flex-1 font-extrabold text-2xl text-white tracking-tight sm:text-[2rem]",
					className,
				)}
			>
				{fallback}
			</h1>
		);
	}

	// If being not found (404 error), show static fallback
	if (beingError?.data?.code === "NOT_FOUND") {
		return (
			<h1
				className={cn(
					"flex-1 font-extrabold text-2xl text-white tracking-tight sm:text-[2rem]",
					className,
				)}
			>
				{beingId}
			</h1>
		);
	}

	// If being found, show editable or read-only name
	const displayName = being?.name || beingId;

	// If read-only mode, just show the text
	if (readOnly) {
		return (
			<span
				className={cn(
					"flex-1 font-extrabold text-white tracking-tight",
					className,
				)}
			>
				{displayName}
			</span>
		);
	}

	return (
		<InlineText
			value={displayName}
			onSave={handleSave}
			placeholder="Click to edit being name"
			disabled={!being || upsertBeing.isPending}
			className={cn(
				"flex-1 font-extrabold text-2xl text-white tracking-tight sm:text-[2rem]",
				className,
			)}
		/>
	);
}
