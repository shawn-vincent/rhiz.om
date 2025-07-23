import { Crown } from "lucide-react";
import { cn } from "~/lib/utils";

interface SuperuserBadgeProps {
	className?: string;
	size?: "sm" | "md" | "lg";
}

export function SuperuserBadge({
	className,
	size = "sm",
}: SuperuserBadgeProps) {
	const sizeClasses = {
		sm: "h-3 w-3",
		md: "h-4 w-4",
		lg: "h-5 w-5",
	};

	return (
		<div
			className={cn(
				"inline-flex items-center justify-center rounded-full bg-yellow-500/20 p-1",
				className,
			)}
			title="Superuser"
		>
			<Crown className={cn("text-yellow-500", sizeClasses[size])} />
		</div>
	);
}
