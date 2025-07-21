
import { cn } from "~/lib/utils";
import type { EntitySummary } from "../../types";
import { SelectedEntityDisplay } from "./SelectedEntityDisplay";

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
        "relative rounded-md p-2 transition-colors hover:bg-accent hover:text-accent-foreground",
        onClick && "cursor-pointer",
        isCompact ? "h-12" : "h-16",
      )}
      onClick={onClick}
      data-type={entity.type}
    >
      {accent && (
        <div className="entity-accent absolute inset-y-0 left-0 w-1 rounded-l-md" />
      )}
      <SelectedEntityDisplay entity={entity} isCompact={isCompact} />
    </div>
  );
}
