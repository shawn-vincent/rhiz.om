// packages/entity-kit/src/components/ui/MobileEntitySelector.tsx
"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import type { EntitySummary } from "../../types";
import { SelectedEntityDisplay } from "./SelectedEntityDisplay";

interface MobileEntitySelectorProps {
	value?: string;
	onValueChange?: (value: string) => void;
	selectUrl: string; // e.g., "/select/being"
	placeholder?: string;
	fieldName?: string;
	className?: string;
}

export function MobileEntitySelector({
	value,
	onValueChange,
	selectUrl,
	placeholder = "Select entity...",
	fieldName = "entityId",
	className,
}: MobileEntitySelectorProps) {
	const router = useRouter();
	const [displayEntity, setDisplayEntity] = useState<EntitySummary | null>(
		null,
	);

	// Fetch the selected entity for display
	const {
		data: fetchedEntity,
		isLoading,
		error,
	} = api.being.getById.useQuery(
		{ id: value! },
		{
			enabled: !!value,
			retry: false, // Don't retry if entity doesn't exist
		},
	);

	useEffect(() => {
		if (fetchedEntity) {
			setDisplayEntity({
				id: fetchedEntity.id,
				name: fetchedEntity.name,
				type: fetchedEntity.type as any, // Type assertion for compatibility
			});
		}
	}, [fetchedEntity]);

	// Listen for postMessage from selection page
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (
				event.data?.type === "BEING_SELECTED" &&
				event.data?.field === fieldName
			) {
				onValueChange?.(event.data.value);
			}
		};

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [fieldName, onValueChange]);

	const handleClick = () => {
		const currentUrl = window.location.pathname + window.location.search;
		const url = new URL(selectUrl, window.location.origin);
		url.searchParams.set("returnUrl", currentUrl);
		url.searchParams.set("field", fieldName);
		if (value) {
			url.searchParams.set("value", value);
		}

		// On mobile, navigate to selection page
		if (window.innerWidth < 768) {
			router.push(url.toString());
		} else {
			// On desktop, open in popup
			window.open(
				url.toString(),
				"entitySelector",
				"width=600,height=700,scrollbars=yes,resizable=yes",
			);
		}
	};

	return (
		<button
			onClick={handleClick}
			type="button"
			className={cn(
				"flex h-mobile-touch w-full cursor-pointer items-center justify-between gap-3 rounded-md border bg-transparent p-3 text-left text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
				!value && "text-muted-foreground",
				className,
			)}
			role="combobox"
			aria-label={placeholder}
		>
			<div className="flex-1 overflow-hidden">
				{displayEntity ? (
					<SelectedEntityDisplay entity={displayEntity} isCompact />
				) : isLoading ? (
					<span className="text-muted-foreground">Loading...</span>
				) : error?.data?.code === "NOT_FOUND" && value ? (
					<span className="text-muted-foreground">
						Entity not found: {value}
					</span>
				) : (
					<span className="text-muted-foreground">{placeholder}</span>
				)}
			</div>
			<ChevronDown className="size-4 shrink-0 opacity-50" />
		</button>
	);
}

// Form field wrapper
interface MobileEntitySelectFieldProps {
	name: string;
	selectUrl: string;
	placeholder?: string;
	className?: string;
}

export function MobileEntitySelectField({
	name,
	selectUrl,
	placeholder,
	className,
}: MobileEntitySelectFieldProps) {
	const { control } = useFormContext();

	return (
		<Controller
			name={name}
			control={control}
			render={({ field }) => (
				<MobileEntitySelector
					value={field.value}
					onValueChange={field.onChange}
					selectUrl={selectUrl}
					placeholder={placeholder}
					fieldName={name}
					className={className}
				/>
			)}
		/>
	);
}
