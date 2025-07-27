"use client";

import type { ReactNode } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "~/components/ui/sheet";
import { useMediaQuery } from "~/hooks/use-media-query";

interface ResponsiveModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: ReactNode;
	children: ReactNode;
	description?: string;
}

export function ResponsiveModal({
	isOpen,
	onClose,
	title,
	children,
	description,
}: ResponsiveModalProps) {
	// Always use Dialog instead of responsive sheets/drawers
	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="flex max-h-[90vh] w-[95vw] max-w-5xl flex-col overflow-hidden">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-3">{title}</DialogTitle>
					{description && <DialogDescription>{description}</DialogDescription>}
				</DialogHeader>
				<div className="mt-6 flex-1 overflow-y-auto">{children}</div>
			</DialogContent>
		</Dialog>
	);
}
