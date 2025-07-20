
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { EntityCard } from "./EntityCard";
import { EntitySkeleton } from "./EntitySkeleton";
import { VirtualList } from "./VirtualList";
import type { EntitySummary } from "../../types";

interface EntitySelectPanelProps {
  value?: string;
  onSelect: (id: string) => void;
  fetchPage: () => void;
  filtersNode?: React.ReactNode;
  items: EntitySummary[];
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onSearchChange: (search: string) => void;
}

export function EntitySelectPanel({
  value,
  onSelect,
  fetchPage,
  filtersNode,
  items,
  isLoading,
  isError,
  isEmpty,
  onSearchChange,
}: EntitySelectPanelProps) {
  return (
    <Command className="h-full w-full">
      <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
        <CommandInput
          placeholder="Search..."
          onValueChange={onSearchChange}
        />
      </div>
      {filtersNode && <div className="p-2 border-b">{filtersNode}</div>}
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
          <VirtualList
            items={items}
            rowHeight={64} // Assuming 64px for non-compact EntityCard
            renderRow={(item) => (
              <CommandItem
                key={item.id}
                value={item.id}
                onSelect={() => onSelect(item.id)}
                className="aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <EntityCard entity={item} accent={item.id === value} />
              </CommandItem>
            )}
            onEndReach={fetchPage}
          />
        )}
      </CommandList>
    </Command>
  );
}
