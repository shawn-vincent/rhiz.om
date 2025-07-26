"use client";

import type { ReactNode } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "~/components/ui/sheet";
import { useMediaQuery } from "../../../packages/entity-kit/src/hooks/use-media-query";

interface ResponsiveModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: ReactNode;
	children: ReactNode;
}

export function ResponsiveModal({
	isOpen,
	onClose,
	title,
	children,
}: ResponsiveModalProps) {
	const isMobile = useMediaQuery("(max-width: 768px)");
	const isTablet = useMediaQuery("(max-width: 1024px)");

	// Mobile: Bottom sheet
	if (isMobile) {
		return (
			<Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
				<SheetContent
					side="bottom"
					className="flex h-[90vh] flex-col overflow-hidden"
				>
					<SheetHeader>
						<SheetTitle className="flex items-center gap-3">
							{title}
						</SheetTitle>
					</SheetHeader>
					<div className="mt-6 flex-1 overflow-y-auto">{children}</div>
				</SheetContent>
			</Sheet>
		);
	}

	// Tablet: Modal dialog
	if (isTablet) {
		return (
			<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
				<DialogContent className="flex max-h-[90vh] w-[95vw] max-w-5xl flex-col overflow-hidden">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-3">
							{title}
						</DialogTitle>
					</DialogHeader>
					<div className="mt-6 flex-1 overflow-y-auto">{children}</div>
				</DialogContent>
			</Dialog>
		);
	}

	// Desktop: Side panel from right
	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<SheetContent
				side="right"
				className="flex w-[90vw] max-w-4xl flex-col overflow-hidden sm:w-[60vw]"
			>
				<SheetHeader>
					<SheetTitle className="flex items-center gap-3">
						{title}
					</SheetTitle>
				</SheetHeader>
				<div className="mt-6 flex-1 overflow-y-auto">{children}</div>
			</SheetContent>
		</Sheet>
	);
}