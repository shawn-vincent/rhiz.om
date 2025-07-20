
import { cn } from "~/lib/utils";
import type { BeingKind, EntitySummary } from "../../types";

interface EntityCardProps {
  entity: EntitySummary;
  variant?: "compact";
  accent?: boolean;
  onClick?: () => void;
}

export function EntityCard({ entity, variant, accent, onClick }: EntityCardProps) {
  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent hover:text-accent-foreground",
        onClick && "cursor-pointer",
        isCompact ? "h-12" : "h-16",
      )}
      onClick={onClick}
      data-kind={entity.kind}
    >
      {accent && (
        <div className="entity-accent absolute inset-y-0 left-0 w-1 rounded-l-md" />
      )}
      {/* Avatar - Placeholder for now */}
      <div className="size-10 shrink-0 rounded-full bg-muted" />

      <div className="flex flex-col overflow-hidden">
        <span className="truncate font-medium text-foreground">
          {entity.name}
        </span>
        {!isCompact && (
          <span className="truncate text-sm text-muted-foreground">
            {entity.kind}
          </span>
        )}
      </div>
    </div>
  );
}
