import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Label } from "~/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { useBeings } from "~/hooks/use-beings";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { EntityCard } from "../../packages/entity-kit/src/components/ui/EntityCard";
import { EntitySelectPanel } from "../../packages/entity-kit/src/components/ui/EntitySelectPanel";
import { ResponsiveShell } from "../../packages/entity-kit/src/components/ui/ResponsiveShell";
import { SelectedEntityDisplay } from "../../packages/entity-kit/src/components/ui/SelectedEntityDisplay";
import { createSelectField } from "../../packages/entity-kit/src/lib/create-select-field";
import type {
	BeingType,
	EntitySummary,
} from "../../packages/entity-kit/src/types";

function BeingTypeFilter({
	value,
	onChange,
}: { value?: BeingType; onChange: (type?: BeingType) => void }) {
	return (
		<div className="flex items-center gap-2">
			<Label htmlFor="type-filter" className="shrink-0 font-medium text-xs">
				Type:
			</Label>
			<Select
				value={value || "all"}
				onValueChange={(val) =>
					onChange(val === "all" ? undefined : (val as BeingType))
				}
			>
				<SelectTrigger className="h-8 text-xs">
					<SelectValue placeholder="All types" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All types</SelectItem>
					<SelectItem value="space">Spaces</SelectItem>
					<SelectItem value="guest">Guests</SelectItem>
					<SelectItem value="bot">Bots</SelectItem>
					<SelectItem value="document">Documents</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}

// Custom BeingSelectField with type filter support
export function BeingSelectField({
	name,
	showTypeFilter = true,
}: { name: string; showTypeFilter?: boolean }) {
	const { control } = useFormContext();

	return (
		<Controller
			name={name}
			control={control}
			render={({ field }) => (
				<BeingSelectComponent
					value={field.value}
					onValueChange={field.onChange}
					showTypeFilter={showTypeFilter}
				/>
			)}
		/>
	);
}

function BeingSelectComponent({
	value,
	onValueChange,
	showTypeFilter,
}: {
	value?: string;
	onValueChange?: (value: string) => void;
	showTypeFilter?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const { items, isLoading, isError, query, setQuery, type, setType } =
		useBeings();

	const selectedEntity = items.find((item) => item.id === value) as
		| EntitySummary
		| undefined;

	const { data: fetchedEntity, isLoading: isFetchingEntity } =
		api.being.getById.useQuery(
			{ id: value! },
			{
				enabled: !!value && !selectedEntity,
			},
		);

	const displayEntity =
		selectedEntity ||
		(fetchedEntity
			? ({
					id: fetchedEntity.id,
					name: fetchedEntity.name,
					type: fetchedEntity.type as BeingType,
				} as EntitySummary)
			: undefined);

	const handleSelect = (id: string) => {
		onValueChange?.(id);
		setOpen(false);
	};

	const filtersNode = showTypeFilter ? (
		<BeingTypeFilter value={type} onChange={setType} />
	) : undefined;

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
					items={items as EntitySummary[]}
					isLoading={isLoading}
					isError={isError}
					isEmpty={items.length === 0 && !isLoading && !isError}
					onSearchChange={setQuery}
					filtersNode={filtersNode}
				/>
			}
		/>
	);
}

// Basic BeingSelect without form integration (for standalone use)
const { Select: BeingSelect } = createSelectField(
	useBeings,
	(entity: EntitySummary) => <EntityCard entity={entity} variant="compact" />,
);

export { BeingSelect };
