import { cn } from "~/lib/utils";
import type { EntitySummary } from "../../types";
import { Avatar } from "~/components/ui/avatar";

interface SelectedEntityDisplayProps {
  entity: EntitySummary;
  isCompact?: boolean;
}

export function SelectedEntityDisplay(
  { entity, isCompact }: SelectedEntityDisplayProps,
) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        isCompact ? "h-12" : "h-16",
      )}
    >
      <Avatar 
        beingId={entity.id}
        beingType={entity.type}
        size="md"
      />

      <div className="flex flex-col overflow-hidden">
        <span className="truncate font-medium text-foreground">
          <span className="text-muted-foreground">
            {entity.type}:&nbsp;
          </span>
          {entity.name}
        </span>
        {!isCompact && (
          <span className="truncate text-sm text-muted-foreground">
            {entity.id}
          </span>
        )}
      </div>
    </div>
  );
}
