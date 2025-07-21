
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { EntitySkeleton } from "./EntitySkeleton";
import type { EntitySummary } from "../../types";
import { SelectedEntityDisplay } from "./SelectedEntityDisplay";

interface EntitySelectPanelProps {
  value?: string;
  onSelect: (id: string) => void;
  items: EntitySummary[];
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onSearchChange: (search: string) => void;
}

export function EntitySelectPanel({
  value,
  onSelect,
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
              <SelectedEntityDisplay entity={item} />
            </CommandItem>
          ))
        )}
      </CommandList>
    </Command>
  );
}
