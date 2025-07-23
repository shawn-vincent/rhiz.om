import { Avatar } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";
import type { EntitySummary } from "../../types";

interface EntityCardProps {
	entity: EntitySummary;
	variant?: "compact" | "default";
	accent?: boolean;
	onClick?: () => void;
	isOnline?: boolean;
}

export function EntityCard({
	entity,
	variant,
	accent,
	onClick,
	isOnline,
}: EntityCardProps) {
	const isCompact = variant === "compact";

	return (
		<div
			className={cn(
				"relative flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent hover:text-accent-foreground",
				onClick && "cursor-pointer",
				isCompact ? "h-12" : "h-16",
			)}
			onClick={onClick}
			data-type={entity.type}
		>
			{accent && (
				<div className="entity-accent absolute inset-y-0 left-0 w-1 rounded-l-md" />
			)}
			<div className="relative">
				<Avatar beingId={entity.id} beingType={entity.type} size="sm" />
				{isOnline !== undefined && (
					<div
						className={cn(
							"-bottom-0.5 -right-0.5 absolute h-3 w-3 rounded-full border-2 border-black",
							isOnline ? "bg-green-400" : "bg-gray-500",
						)}
					/>
				)}
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate font-semibold">{entity.name}</p>
				{!isCompact && (
					<p className="truncate text-muted-foreground text-sm">{entity.id}</p>
				)}
			</div>
		</div>
	);
}
