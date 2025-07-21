import { Bot, FileText, MapPinned, UserRound } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

export type BeingType = "space" | "guest" | "bot" | "document";

interface AvatarProps {
  beingId: string;
  beingType?: BeingType;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** If true, will fetch being data to determine type automatically */
  autoDetectType?: boolean;
}

const sizeClasses = {
  sm: "size-8",  // 32px - for chat
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
  autoDetectType = false 
}: AvatarProps) {
  const sizeClass = sizeClasses[size];
  const iconSize = iconSizeClasses[size];
  
  // Fetch being data if auto-detection is enabled and no type provided
  const { data: beingData } = api.being.getById.useQuery(
    { id: beingId },
    { 
      enabled: autoDetectType && !beingType,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );
  
  // Determine the final being type
  const finalBeingType: BeingType = beingType || (beingData?.type as BeingType) || "guest";
  
  return (
    <div 
      className={cn(
        "shrink-0 rounded-full bg-muted flex items-center justify-center",
        sizeClass,
        className
      )}
      title={`${finalBeingType}: ${beingId}`}
    >
      {getBeingIcon(finalBeingType, iconSize)}
    </div>
  );
}