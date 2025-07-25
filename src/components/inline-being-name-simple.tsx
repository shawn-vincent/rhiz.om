// src/components/inline-being-name-simple.tsx
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InlineText } from "~/components/ui/inline-editable";
import { callBeingAPI, getCachedBeing } from "~/hooks/use-simple-sync";
import { logger } from "~/lib/logger.client";
import { cn } from "~/lib/utils";

const inlineBeingLogger = logger.child({ name: "InlineBeingNameSimple" });

interface InlineBeingNameProps {
	fallback?: string;
	className?: string;
	readOnly?: boolean;
}

export function InlineBeingNameSimple({
	fallback = "Rhiz.om",
	className,
	readOnly = false,
}: InlineBeingNameProps) {
	const params = useParams();
	const beingId = params.beingId
		? decodeURIComponent(params.beingId as string)
		: undefined;

	const [isUpdating, setIsUpdating] = useState(false);
	const [being, setBeing] = useState(() =>
		beingId ? getCachedBeing(beingId) : undefined,
	);

	// Update being from cache when it changes
	useEffect(() => {
		if (!beingId) return;

		const updateBeing = () => {
			const cachedBeing = getCachedBeing(beingId);
			if (cachedBeing) {
				setBeing(cachedBeing);
			}
		};

		// Check immediately
		updateBeing();

		// Check periodically for cache updates
		const interval = setInterval(updateBeing, 1000);
		return () => clearInterval(interval);
	}, [beingId]);

	const handleSave = async (newName: string) => {
		if (!being || !beingId || isUpdating) return;

		setIsUpdating(true);
		try {
			await callBeingAPI({
				action: "update",
				beingId,
				data: {
					...being,
					name: newName,
				},
			});

			// Update local state immediately for optimistic UI
			setBeing({ ...being, name: newName });
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
