import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { EntitySelectPanel } from "../components/ui/EntitySelectPanel";
import { ResponsiveShell } from "../components/ui/ResponsiveShell";
import { SelectedEntityDisplay } from "../components/ui/SelectedEntityDisplay";
import type { EntitySummary } from "../types";

interface SelectProps {
	value?: string;
	onValueChange?: (value: string) => void;
	renderCard: (entity: EntitySummary) => React.ReactNode;
	useHook: (initialValue?: any) => any; // Simplified for now
	filtersNode?: React.ReactNode;
}

export function createSelectField(
	useHook: (initialValue?: any) => any,
	renderCard: (entity: EntitySummary) => React.ReactNode,
) {
	const Select = ({
		value,
		onValueChange,
		renderCard,
		useHook,
		filtersNode,
	}: SelectProps) => {
		const [open, setOpen] = useState(false);
		const { items, isLoading, isError, query, setQuery } = useHook();

		const selectedEntity = items.find(
			(item: EntitySummary) => item.id === value,
		);

		const { data: fetchedEntity, isLoading: isFetchingEntity } =
			api.being.getById.useQuery(
				{ id: value! },
				{
					enabled: !!value && !selectedEntity,
				},
			);

		const displayEntity = selectedEntity || fetchedEntity;

		const handleSelect = (id: string) => {
			onValueChange?.(id);
			setOpen(false);
		};

		return (
			<ResponsiveShell
				open={open}
				onOpenChange={setOpen}
				trigger={
					<div
						className={cn(
							"flex h-16 w-full min-w-0 max-w-[200px] cursor-pointer items-center justify-between gap-3 rounded-md border bg-transparent p-2 text-left text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
							!value && "text-muted-foreground",
						)}
						role="combobox"
						aria-expanded={open}
					>
						{displayEntity ? (
							<SelectedEntityDisplay entity={displayEntity} />
						) : isFetchingEntity ? (
							"Loading..."
						) : (
							"Select entity..."
						)}
						<ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</div>
				}
				panel={
					<EntitySelectPanel
						value={value}
						onSelect={handleSelect}
						items={items}
						isLoading={isLoading}
						isError={isError}
						isEmpty={items.length === 0 && !isLoading && !isError}
						onSearchChange={setQuery}
						filtersNode={filtersNode}
					/>
				}
			/>
		);
	};

	const SelectField = ({
		name,
		filtersNode,
	}: {
		name: string;
		filtersNode?: React.ReactNode;
	}) => {
		const { control } = useFormContext();
		return (
			<Controller
				name={name}
				control={control}
				render={({ field }) => (
					<Select
						renderCard={renderCard}
						useHook={useHook}
						value={field.value}
						onValueChange={field.onChange}
						filtersNode={filtersNode}
					/>
				)}
			/>
		);
	};

	return { Select, SelectField };
}
