"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useCallback } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod/v4";
import { BeingForm } from "~/app/_components/being-form";
import { Button } from "~/components/ui/button";
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
import { insertBeingSchema } from "~/server/db/types";
import { api } from "~/trpc/react";
import { useMediaQuery } from "../../packages/entity-kit/src/hooks/use-media-query";

interface BeingCreateModalProps {
	spaceId: string;
	isOpen: boolean;
	onClose: () => void;
	onCreated?: (beingId: string) => void;
}

type BeingFormData = z.infer<typeof insertBeingSchema>;

export function BeingCreateModal({
	spaceId,
	isOpen,
	onClose,
	onCreated,
}: BeingCreateModalProps) {
	const isMobile = useMediaQuery("(max-width: 768px)");
	const isTablet = useMediaQuery("(max-width: 1024px)");
	const utils = api.useUtils();
	const { data: session } = useSession();

	const createBeing = api.being.upsert.useMutation({
		onSuccess: async (data) => {
			await utils.being.getAll.invalidate();
			await utils.being.getByLocation.invalidate({ locationId: spaceId });
			toast.success("Being created successfully");
			if (
				data &&
				typeof data === "object" &&
				"id" in data &&
				typeof data.id === "string"
			) {
				onCreated?.(data.id);
			}
			onClose();
		},
		onError: (err) => {
			toast.error(`Failed to create being: ${err.message}`);
		},
	});

	// Generate a unique ID for new being
	const generateBeingId = () => {
		const randomPart = Math.random().toString(36).substring(2, 8);
		return `@new-being-${randomPart}`;
	};

	const baseDefaults: BeingFormData = {
		id: generateBeingId(),
		name: "",
		type: "guest",
		ownerId: session?.user?.beingId ?? undefined,
		locationId: spaceId,
		extIds: [],
		idHistory: [],
		metadata: {},
		properties: {},
		content: [],
		botModel: "",
		botPrompt: "",
	};

	const methods = useForm<BeingFormData>({
		resolver: zodResolver(insertBeingSchema) as any,
		defaultValues: baseDefaults,
	});

	const handleSubmit = async (data: BeingFormData) => {
		await createBeing.mutate(data);
	};

	const handleCancel = useCallback(() => {
		methods.reset(baseDefaults);
		onClose();
	}, [onClose, methods, baseDefaults]);

	if (!isOpen) return null;

	const content = (
		<FormProvider {...methods}>
			<form
				onSubmit={methods.handleSubmit(handleSubmit as any)}
				className="space-y-6"
			>
				<BeingForm />
				<div className="-mx-6 sticky bottom-0 border-t bg-background px-6 pt-4 pb-4">
					<div className="flex gap-3">
						<Button
							type="button"
							variant="outline"
							className="flex-1"
							onClick={handleCancel}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							className="flex-1"
							disabled={methods.formState.isSubmitting}
						>
							{methods.formState.isSubmitting ? "Creating…" : "Create Being"}
						</Button>
					</div>
				</div>
			</form>
		</FormProvider>
	);

	// Mobile: Bottom sheet
	if (isMobile) {
		return (
			<Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
				<SheetContent
					side="bottom"
					className="flex h-[90vh] flex-col overflow-hidden"
				>
					<SheetHeader>
						<SheetTitle>Create New Being</SheetTitle>
					</SheetHeader>
					<div className="mt-6 flex-1 overflow-y-auto">{content}</div>
				</SheetContent>
			</Sheet>
		);
	}

	// Tablet: Modal dialog
	if (isTablet) {
		return (
			<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
				<DialogContent className="flex max-h-[90vh] max-w-5xl w-[min(95vw,5xl)] flex-col overflow-hidden">
					<DialogHeader>
						<DialogTitle>Create New Being</DialogTitle>
					</DialogHeader>
					<div className="mt-6 flex-1 overflow-y-auto">{content}</div>
				</DialogContent>
			</Dialog>
		);
	}

	// Desktop: Side panel from right
	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<SheetContent
				side="right"
				className="flex w-[min(95vw,800px)] flex-col overflow-hidden sm:max-w-[800px]"
			>
				<SheetHeader>
					<SheetTitle>Create New Being</SheetTitle>
				</SheetHeader>
				<div className="mt-6 flex-1 overflow-y-auto">{content}</div>
			</SheetContent>
		</Sheet>
	);
}
