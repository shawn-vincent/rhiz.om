// src/app/_components/being-editor-modal.tsx
"use client";

import { Pencil } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import ErrorBoundary from "~/components/ui/error-boundary";
import type { BeingId } from "~/lib/types";
import { BeingEditor } from "./being-editor";

interface BeingEditorModalProps {
	beingId: BeingId;
	title: string;
}

export function BeingEditorModal({ beingId, title }: BeingEditorModalProps) {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Edit Being">
					<Pencil className="size-5" />
				</Button>
			</DialogTrigger>
			<DialogContent className="flex h-[90vh] max-w-[80vw] flex-col">
				<ErrorBoundary>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>
					<BeingEditor beingId={beingId} />
				</ErrorBoundary>
			</DialogContent>
		</Dialog>
	);
}
