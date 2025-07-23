import { Pencil } from "lucide-react";
import { Avatar } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { EntitySummary } from "../../types";

interface EntityCardProps {
	entity: EntitySummary;
	variant?: "compact" | "default";
	accent?: boolean;
	onClick?: () => void;
	onEdit?: () => void;
	isOnline?: boolean;
	isSelected?: boolean;
	showEditButton?: boolean;
}

export function EntityCard({
	entity,
	variant,
	accent,
	onClick,
	onEdit,
	isOnline,
	isSelected,
	showEditButton,
}: EntityCardProps) {
	const isCompact = variant === "compact";

	return (
		<div
			className={cn(
				"relative flex items-center gap-3 rounded-md p-2 transition-colors",
				onClick &&
					"cursor-pointer hover:bg-accent hover:text-accent-foreground",
				isSelected && "bg-accent/50 ring-2 ring-primary",
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
							"-bottom-0.5 -right-0.5 absolute h-3 w-3 rounded-full border-2 border-background",
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
			{showEditButton && onEdit && (
				<Button
					size="sm"
					variant="ghost"
					className="h-8 w-8 p-0"
					onClick={(e) => {
						e.stopPropagation();
						onEdit();
					}}
				>
					<Pencil className="h-4 w-4" />
					<span className="sr-only">Edit {entity.name}</span>
				</Button>
			)}
		</div>
	);
}
