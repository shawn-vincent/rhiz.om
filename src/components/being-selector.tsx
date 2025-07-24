import { Bot, ChevronDown, FileText, MapPinned, UserRound } from "lucide-react";
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
import type {
	BeingType,
	EntitySummary,
} from "../../packages/entity-kit/src/types";

// Generic EntitySelector - reusable for any entity type
interface EntitySelectorProps<T extends EntitySummary> {
	value?: string;
	onValueChange?: (value: string) => void;
	items: T[];
	isLoading: boolean;
	isError: boolean;
	onSearchChange: (query: string) => void;
	filtersNode?: React.ReactNode;
	placeholder?: string;
}

function EntitySelector<T extends EntitySummary>({
	value,
	onValueChange,
	items,
	isLoading,
	isError,
	onSearchChange,
	filtersNode,
	placeholder = "Select entity...",
}: EntitySelectorProps<T>) {
	const [open, setOpen] = useState(false);

	const selectedEntity = items.find((item) => item.id === value);

	const { data: fetchedEntity, isLoading: isFetchingEntity } =
		api.being.getById.useQuery(
			{ id: value as string },
			{ enabled: !!value && !selectedEntity },
		);

	const displayEntity =
		selectedEntity ||
		(fetchedEntity
			? ({
					id: fetchedEntity.id,
					name: fetchedEntity.name,
					type: fetchedEntity.type as BeingType,
				} as T)
			: undefined);

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
						"flex h-16 w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-md border bg-transparent p-2 text-left text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
						!value && "text-muted-foreground",
					)}
					role="combobox"
					aria-expanded={open}
				>
					{displayEntity ? (
						<EntityCard entity={displayEntity} variant="compact" />
					) : isFetchingEntity ? (
						"Loading..."
					) : (
						placeholder
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
					onSearchChange={onSearchChange}
					filtersNode={filtersNode}
				/>
			}
		/>
	);
}

// Being-specific filter component
function BeingTypeFilter({
	value,
	onChange,
}: { value?: BeingType; onChange: (type?: BeingType) => void }) {
	const typeOptions = [
		{ value: "all", label: "All types", icon: null },
		{ value: "space", label: "Spaces", icon: MapPinned },
		{ value: "guest", label: "Guests", icon: UserRound },
		{ value: "bot", label: "Bots", icon: Bot },
		{ value: "document", label: "Documents", icon: FileText },
	] as const;

	const selectedOption = typeOptions.find(
		(opt) => opt.value === (value || "all"),
	);

	return (
		<div className="flex items-center gap-2">
			<Label className="shrink-0 font-medium text-xs">Type:</Label>
			<Select
				value={value || "all"}
				onValueChange={(val) =>
					onChange(val === "all" ? undefined : (val as BeingType))
				}
			>
				<SelectTrigger className="h-8 text-xs">
					<SelectValue placeholder="All types">
						{selectedOption && (
							<div className="flex items-center gap-1.5">
								{selectedOption.icon && (
									<selectedOption.icon className="size-3 text-muted-foreground" />
								)}
								<span>{selectedOption.label}</span>
							</div>
						)}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{typeOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							<div className="flex items-center gap-1.5">
								{option.icon && (
									<option.icon className="size-3 text-muted-foreground" />
								)}
								<span>{option.label}</span>
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

// BeingSelector - extends EntitySelector with being-specific logic
interface BeingSelectorProps {
	value?: string;
	onValueChange?: (value: string) => void;
	showTypeFilter?: boolean;
	placeholder?: string;
	defaultTypeFilter?: BeingType;
}

export function BeingSelector({
	value,
	onValueChange,
	showTypeFilter = true,
	placeholder,
	defaultTypeFilter,
}: BeingSelectorProps) {
	const { items, isLoading, isError, query, setQuery, type, setType } =
		useBeings(defaultTypeFilter);

	const filtersNode = showTypeFilter ? (
		<BeingTypeFilter value={type} onChange={setType} />
	) : undefined;

	return (
		<EntitySelector
			value={value}
			onValueChange={onValueChange}
			items={items}
			isLoading={isLoading}
			isError={isError}
			onSearchChange={setQuery}
			filtersNode={filtersNode}
			placeholder={placeholder}
		/>
	);
}

// Form field wrapper
export function BeingSelectField({
	name,
	showTypeFilter = true,
	placeholder,
	defaultTypeFilter,
}: {
	name: string;
	showTypeFilter?: boolean;
	placeholder?: string;
	defaultTypeFilter?: BeingType;
}) {
	const { control } = useFormContext();

	return (
		<Controller
			name={name}
			control={control}
			render={({ field }) => (
				<BeingSelector
					value={field.value}
					onValueChange={field.onChange}
					showTypeFilter={showTypeFilter}
					placeholder={placeholder}
					defaultTypeFilter={defaultTypeFilter}
				/>
			)}
		/>
	);
}
