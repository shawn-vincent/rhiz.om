import { cn } from "~/lib/utils";
import type { EntitySummary } from "../../types";
import { Bot, FileText, MapPinned, SquareStack, UserRound } from "lucide-react";

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
      <div className="size-10 shrink-0 rounded-full bg-muted flex items-center justify-center">
        {entity.type === "space" && (
          <MapPinned className="size-6 text-muted-foreground" />
        )}
        {entity.type === "bot" && (
          <Bot className="size-6 text-muted-foreground" />
        )}
        {entity.type === "guest" && (
          <UserRound className="size-6 text-muted-foreground" />
        )}
        {entity.type === "document" && (
          <FileText className="size-6 text-muted-foreground" />
        )}
      </div>

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
