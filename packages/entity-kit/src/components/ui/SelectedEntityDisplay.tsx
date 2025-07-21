import { Avatar } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import type { EntitySummary } from "../../types";

interface SelectedEntityDisplayProps {
	entity: EntitySummary;
	isCompact?: boolean;
}

export function SelectedEntityDisplay({
	entity,
	isCompact,
}: SelectedEntityDisplayProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-mobile-gap",
				isCompact ? "h-mobile-touch" : "h-14",
			)}
		>
			<Avatar beingId={entity.id} beingType={entity.type} size="md" />

			<div className="flex flex-col overflow-hidden">
				<span className="truncate font-medium text-foreground">
					<span className="xs:hidden text-muted-foreground">
						{entity.type}:&nbsp;
					</span>
					{entity.name}
				</span>
				{!isCompact && (
					<span className="truncate text-muted-foreground text-sm xs:text-xs">
						{entity.id}
					</span>
				)}
			</div>
		</div>
	);
}
