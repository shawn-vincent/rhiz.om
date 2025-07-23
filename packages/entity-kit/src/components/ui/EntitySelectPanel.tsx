import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "~/components/ui/command";
import type { EntitySummary } from "../../types";
import { EntityCard } from "./EntityCard";
import { EntitySkeleton } from "./EntitySkeleton";

interface EntitySelectPanelProps {
	value?: string;
	onSelect: (id: string) => void;
	items: EntitySummary[];
	isLoading: boolean;
	isError: boolean;
	isEmpty: boolean;
	onSearchChange: (search: string) => void;
	filtersNode?: React.ReactNode;
}

export function EntitySelectPanel({
	value,
	onSelect,
	items,
	isLoading,
	isError,
	isEmpty,
	onSearchChange,
	filtersNode,
}: EntitySelectPanelProps) {
	return (
		<Command className="h-full w-full">
			<div className="flex items-center border-b px-3" cmdk-input-wrapper="">
				<CommandInput placeholder="Search..." onValueChange={onSearchChange} />
			</div>
			{filtersNode && <div className="border-b px-3 py-2">{filtersNode}</div>}
			<CommandList className="flex-1">
				{isLoading && items.length === 0 ? (
					<div className="p-2">
						<EntitySkeleton />
						<EntitySkeleton />
						<EntitySkeleton />
					</div>
				) : isError ? (
					<CommandEmpty>Error loading results.</CommandEmpty>
				) : isEmpty ? (
					<CommandEmpty>No results found.</CommandEmpty>
				) : (
					items.map((item) => (
						<CommandItem
							key={item.id}
							value={item.id}
							onSelect={() => onSelect(item.id)}
							className="aria-selected:bg-accent aria-selected:text-accent-foreground"
						>
							<EntityCard entity={item} variant="compact" />
						</CommandItem>
					))
				)}
			</CommandList>
		</Command>
	);
}
