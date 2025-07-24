import { Bot, FileText, MapPinned, UserRound } from "lucide-react";
import { useSession } from "next-auth/react";
import { isSuperuser } from "~/lib/permissions";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { SuperuserBadge } from "./superuser-badge";

export type BeingType = "space" | "guest" | "bot" | "document";

interface AvatarProps {
	beingId: string;
	beingType?: BeingType;
	size?: "sm" | "md" | "lg";
	className?: string;
	/** If true, will fetch being data to determine type automatically */
	autoDetectType?: boolean;
	/** If true, will show superuser badge if this being is a superuser */
	showSuperuserBadge?: boolean;
}

const sizeClasses = {
	sm: "size-8", // 32px - for chat
	md: "size-10", // 40px - for cards
	lg: "size-12", // 48px - for headers
};

const iconSizeClasses = {
	sm: "size-6",
	md: "size-8",
	lg: "size-9",
};

function getBeingIcon(type: BeingType, iconSize: string) {
	const iconProps = { className: `${iconSize} text-foreground` };

	switch (type) {
		case "space":
			return <MapPinned {...iconProps} />;
		case "bot":
			return <Bot {...iconProps} />;
		case "guest":
			return <UserRound {...iconProps} />;
		case "document":
			return <FileText {...iconProps} />;
		default:
			return <UserRound {...iconProps} />;
	}
}

export function Avatar({
	beingId,
	beingType,
	size = "md",
	className,
	autoDetectType = false,
	showSuperuserBadge = false,
}: AvatarProps) {
	const sizeClass = sizeClasses[size];
	const iconSize = iconSizeClasses[size];

	// Fetch being data for name and type detection
	const { data: beingData } = api.being.getById.useQuery(
		{ id: beingId },
		{
			enabled: autoDetectType && !beingType,
			staleTime: 5 * 60 * 1000, // Cache for 5 minutes
		},
	);

	// Always fetch being data for name display in title
	const { data: beingNameData } = api.being.getById.useQuery(
		{ id: beingId },
		{
			staleTime: 5 * 60 * 1000, // Cache for 5 minutes
		},
	);

	// Check if this being is a superuser (only when showSuperuserBadge is true)
	const isCurrentUserSuperuser = showSuperuserBadge
		? isSuperuser(beingNameData)
		: false;

	// Determine the final being type
	const finalBeingType: BeingType =
		beingType || (beingData?.type as BeingType) || "guest";

	return (
		<div className="relative">
			<div
				className={cn(
					"flex shrink-0 items-center justify-center rounded-full bg-muted",
					sizeClass,
					className,
				)}
				title={beingNameData?.name || beingId}
			>
				{getBeingIcon(finalBeingType, iconSize)}
			</div>

			{/* Superuser badge overlay */}
			{isCurrentUserSuperuser && (
				<div className="-bottom-1 -right-1 absolute">
					<SuperuserBadge size="sm" />
				</div>
			)}
		</div>
	);
}
