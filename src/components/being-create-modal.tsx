"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useCallback, useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod/v4";
import { BeingForm } from "~/app/_components/being-form";
import { Avatar } from "~/components/ui/avatar";
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
import type { BeingType } from "../../packages/entity-kit/src/types";
import { api } from "~/trpc/react";
import { useMediaQuery } from "../../packages/entity-kit/src/hooks/use-media-query";

interface BeingCreateModalProps {
	isOpen: boolean;
	onClose: () => void;
	onCreated?: (beingId: string) => void;
	defaultValues?: Partial<BeingFormData>;
}

type BeingFormData = z.infer<typeof insertBeingSchema>;

export function BeingCreateModal({
	isOpen,
	onClose,
	onCreated,
	defaultValues = {},
}: BeingCreateModalProps) {
	const isMobile = useMediaQuery("(max-width: 768px)");
	const isTablet = useMediaQuery("(max-width: 1024px)");
	const utils = api.useUtils();
	const { data: session } = useSession();

	const createBeing = api.being.upsert.useMutation({
		onSuccess: async (newBeing) => {
			console.log("🐛 BeingCreateModal - onSuccess newBeing:", newBeing);
			console.log("🐛 BeingCreateModal - onSuccess newBeing.id:", newBeing?.id);
			
			await utils.being.getAll.invalidate();
			await utils.being.getByLocation.invalidate();
			toast.success("Being created successfully");
			
			if (newBeing?.id) {
				onCreated?.(newBeing.id);
			} else {
				console.error("🔥 BeingCreateModal - newBeing.id is undefined!", newBeing);
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
		const generatedId = `@new-being-${randomPart}`;
		console.log("🐛 BeingCreateModal - generated ID:", generatedId);
		return generatedId;
	};

	const baseDefaults: BeingFormData = {
		id: generateBeingId(),
		name: "",
		type: "guest",
		ownerId: session?.user?.beingId ?? undefined,
		locationId: undefined,
		extIds: [],
		idHistory: [],
		metadata: {},
		properties: {},
		content: [],
		botModel: "",
		botPrompt: "",
		...defaultValues,
	};

	const methods = useForm<BeingFormData>({
		resolver: zodResolver(insertBeingSchema) as any,
		defaultValues: baseDefaults,
	});

	// Reset form when modal opens with new default values
	useEffect(() => {
		if (isOpen) {
			const generatedId = generateBeingId();
			const newDefaults = {
				id: generatedId,
				name: "",
				type: "guest",
				ownerId: session?.user?.beingId ?? undefined,
				locationId: undefined,
				extIds: [],
				idHistory: [],
				metadata: {},
				properties: {},
				content: [],
				botModel: "",
				botPrompt: "",
				...defaultValues,
			};
			console.log("🐛 BeingCreateModal - useEffect newDefaults:", newDefaults);
			console.log("🐛 BeingCreateModal - useEffect generatedId:", generatedId);
			methods.reset(newDefaults);
		}
	}, [isOpen, defaultValues, methods, session?.user?.beingId]);

	const handleSubmit = async (data: BeingFormData) => {
		console.log("🐛 BeingCreateModal - handleSubmit data:", data);
		console.log("🐛 BeingCreateModal - handleSubmit data.id:", data.id);
		await createBeing.mutate(data);
	};

	const handleCancel = useCallback(() => {
		onClose();
	}, [onClose]);

	if (!isOpen) return null;

	const typeDisplayName = (defaultValues.type as BeingType) || "guest";
	const titleText = `Create New ${typeDisplayName === "space" ? "Space" : typeDisplayName === "bot" ? "Bot" : "Being"}`;

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
							{methods.formState.isSubmitting ? "Creating…" : "Create"}
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
						<SheetTitle className="flex items-center gap-3">
							<Avatar 
								beingId="@new-being" 
								beingType={typeDisplayName} 
								size="md"
								className="h-8 w-8"
							/>
							{titleText}
						</SheetTitle>
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
				<DialogContent className="flex max-h-[90vh] max-w-5xl w-[95vw] flex-col overflow-hidden">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-3">
						<Avatar 
							beingId="@new-being" 
							beingType={typeDisplayName} 
							size="md"
							className="h-8 w-8"
						/>
						{titleText}
					</DialogTitle>
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
				className="flex w-[95vw] max-w-none flex-col overflow-hidden"
			>
				<SheetHeader>
					<SheetTitle className="flex items-center gap-3">
					<Avatar 
						beingId="@new-being" 
						beingType={typeDisplayName} 
						size="md"
						className="h-8 w-8"
					/>
					{titleText}
				</SheetTitle>
				</SheetHeader>
				<div className="mt-6 flex-1 overflow-y-auto">{content}</div>
			</SheetContent>
		</Sheet>
	);
}
