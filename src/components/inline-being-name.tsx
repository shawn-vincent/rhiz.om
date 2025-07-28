// src/components/inline-being-name.tsx
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InlineText } from "~/components/ui/inline-editable";
import { useSync } from "~/hooks/use-stream";
import { logger } from "~/lib/logger.client";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

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

	const [isUpdating, setIsUpdating] = useState(false);

	// Get beings from tRPC only (no more sync beings)
	const beingsQuery = api.being.getAll.useQuery(void 0, {
		staleTime: 5 * 60 * 1000,
	});

	// Find being in global data
	const being = beingId
		? beingsQuery.data?.find((b) => b.id === beingId)
		: undefined;

	const upsertBeing = api.being.upsert.useMutation();

	const handleSave = async (newName: string) => {
		if (!being || !beingId || isUpdating) return;

		setIsUpdating(true);
		try {
			await upsertBeing.mutateAsync({
				...being,
				name: newName,
				// Convert null values to undefined for insertBeingSchema compatibility
				extIds: being.extIds ?? undefined,
				idHistory: being.idHistory ?? undefined,
				metadata: being.metadata ?? undefined,
				properties: being.properties ?? undefined,
				content: being.content ?? undefined,
				botModel: being.botModel ?? undefined,
				botPrompt: being.botPrompt ?? undefined,
				llmApiKey: being.llmApiKey ?? undefined,
			});

			// Optimistic update will be handled by the sync system
		} catch (error) {
			inlineBeingLogger.error(
				error,
				`Failed to update being name: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			throw error; // Re-throw to let InlineText handle the error
		} finally {
			setIsUpdating(false);
		}
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

	// Track if we're hydrated to prevent SSR mismatch
	const [isHydrated, setIsHydrated] = useState(false);
	useEffect(() => {
		setIsHydrated(true);
	}, []);

	// During SSR/before hydration, always show beingId to prevent mismatch
	const displayName = (isHydrated && being?.name) || beingId;

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
			disabled={!being || isUpdating}
			className={cn(
				"flex-1 font-extrabold text-2xl text-white tracking-tight sm:text-[2rem]",
				className,
			)}
		/>
	);
}
