"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import type { InsertBeing } from "~/server/db/types";
import { insertBeingSchema } from "~/server/db/types";
import { api } from "~/trpc/react";
import { useMediaQuery } from "../../packages/entity-kit/src/hooks/use-media-query";
import type { BeingType } from "../../packages/entity-kit/src/types";

interface BeingEditModalProps {
	beingId: string | null;
	isOpen: boolean;
	onClose: () => void;
	onSaved?: () => void;
}

type BeingFormData = z.infer<typeof insertBeingSchema>;

export function BeingEditModal({
	beingId,
	isOpen,
	onClose,
	onSaved,
}: BeingEditModalProps) {
	const isMobile = useMediaQuery("(max-width: 768px)");
	const isTablet = useMediaQuery("(max-width: 1024px)");
	const utils = api.useUtils();

	const { data: being, isLoading } = api.being.getById.useQuery(
		{ id: beingId ?? "" },
		{ enabled: !!beingId && isOpen },
	);

	const upsertBeing = api.being.upsert.useMutation({
		onSuccess: async () => {
			await utils.being.getById.invalidate({ id: beingId ?? "" });
			await utils.being.getAll.invalidate();
			toast.success("Being updated successfully");
			onSaved?.();
			onClose();
		},
		onError: (err) => {
			toast.error(`Failed to save being: ${err.message}`);
		},
	});

	// Create form with proper initial values based on being data
	const getInitialValues = (): BeingFormData => {
		if (being) {
			return {
				...being,
				ownerId: being.ownerId ?? undefined,
				locationId: being.locationId ?? undefined,
				extIds: being.extIds ?? undefined,
				idHistory: being.idHistory ?? undefined,
				metadata: being.metadata ?? undefined,
				properties: being.properties ?? undefined,
				content: being.content ?? undefined,
				botModel: being.botModel ?? undefined,
				botPrompt: being.botPrompt ?? undefined,
			};
		}
		return {
			id: "",
			name: "",
			type: "guest",
			ownerId: undefined,
			locationId: undefined,
			extIds: [],
			idHistory: [],
			metadata: {},
			properties: {},
			content: [],
			botModel: "",
			botPrompt: "",
		};
	};

	const methods = useForm<BeingFormData>({
		resolver: zodResolver(insertBeingSchema) as any,
		defaultValues: getInitialValues(),
	});

	// Watch the type field to update UI elements reactively
	const currentType = methods.watch("type");

	// Reset form when being data becomes available
	useEffect(() => {
		if (being) {
			const formValues: BeingFormData = {
				...being,
				ownerId: being.ownerId ?? undefined,
				locationId: being.locationId ?? undefined,
				extIds: being.extIds ?? undefined,
				idHistory: being.idHistory ?? undefined,
				metadata: being.metadata ?? undefined,
				properties: being.properties ?? undefined,
				content: being.content ?? undefined,
				botModel: being.botModel ?? undefined,
				botPrompt: being.botPrompt ?? undefined,
			};
			methods.reset(formValues);
		}
	}, [being, methods]);

	const handleSubmit = async (data: BeingFormData) => {
		await upsertBeing.mutate(data);
	};

	const handleCancel = useCallback(() => {
		onClose();
	}, [onClose]);

	if (!beingId || !isOpen) return null;

	// Get reactive display name and type - prefer currentType from form, fallback to being.type, then "guest"
	const typeDisplayName =
		(currentType as BeingType) || (being?.type as BeingType) || "guest";
	const typeLabel =
		typeDisplayName === "space"
			? "Space"
			: typeDisplayName === "bot"
				? "Bot"
				: typeDisplayName === "document"
					? "Document"
					: "Being";
	const titleText = `Edit ${being?.name ?? typeLabel}`;

	const content = (
		<>
			{isLoading ? (
				<div className="flex items-center justify-center p-8">
					<div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
				</div>
			) : being ? (
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
									{methods.formState.isSubmitting ? "Saving…" : "Save"}
								</Button>
							</div>
						</div>
					</form>
				</FormProvider>
			) : (
				<div className="p-8 text-center text-muted-foreground">
					Being not found
				</div>
			)}
		</>
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
								beingId={being?.id || "@new-being"}
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
				<DialogContent className="flex max-h-[90vh] w-[95vw] max-w-5xl flex-col overflow-hidden">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-3">
							<Avatar
								beingId={being?.id || "@new-being"}
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
							beingId={being?.id || "@new-being"}
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
