import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { useMediaQuery } from "../../hooks/use-media-query";

interface ResponsiveShellProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	trigger: React.ReactNode;
	panel: React.ReactNode;
}

export function ResponsiveShell({
	open,
	onOpenChange,
	trigger,
	panel,
}: ResponsiveShellProps) {
	const isDesktop = useMediaQuery("(min-width: 768px)"); // Equivalent to Tailwind's md breakpoint

	if (isDesktop) {
		return (
			<Popover open={open} onOpenChange={onOpenChange}>
				<PopoverTrigger asChild>{trigger}</PopoverTrigger>
				<PopoverContent
					className="w-[min(calc(100vw-2rem),max(400px,var(--radix-popover-trigger-width)))] max-w-2xl p-0"
					align="start"
					side="bottom"
					sideOffset={8}
					collisionPadding={16}
					avoidCollisions={true}
				>
					{panel}
				</PopoverContent>
			</Popover>
		);
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetTrigger asChild>{trigger}</SheetTrigger>
			<SheetContent side="bottom" className="h-full rounded-t-lg p-0">
				{panel}
			</SheetContent>
		</Sheet>
	);
}
