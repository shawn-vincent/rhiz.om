"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";
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
import { type InsertBeing, insertBeingSchema } from "~/server/db/types";
import { api } from "~/trpc/react";
import { useMediaQuery } from "../../packages/entity-kit/src/hooks/use-media-query";
import type { BeingType } from "../../packages/entity-kit/src/types";

interface BeingCreateModalProps {
	isOpen: boolean;
	onClose: () => void;
	onCreated?: (beingId: string) => void;
	defaultValues?: Partial<BeingFormData>;
}

// Custom schema for form that makes ID optional (will be generated on save)
const beingFormSchema = insertBeingSchema.extend({
	id: z.string().optional().default(""),
});

type BeingFormData = z.infer<typeof beingFormSchema>;

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
			await utils.being.getAll.invalidate();
			await utils.being.getByLocation.invalidate();
			toast.success("Being created successfully");

			if (newBeing?.id) {
				onCreated?.(newBeing.id);
			}

			onClose();
		},
		onError: (err) => {
			toast.error(`Failed to create being: ${err.message}`);
		},
	});

	const baseDefaults: BeingFormData = useMemo(
		() => ({
			id: "", // ID will be generated on save, not in form
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
		}),
		[session?.user?.beingId, defaultValues],
	);

	const methods = useForm<BeingFormData>({
		resolver: zodResolver(beingFormSchema) as any,
		defaultValues: baseDefaults,
	});

	// Watch the type field to update UI elements reactively
	const currentType = methods.watch("type");

	// Reset form when modal opens with existing default values
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => {
		if (isOpen) {
			methods.reset(baseDefaults);
		}
	}, [isOpen, baseDefaults]);

	const handleSubmit = async (data: BeingFormData) => {
		console.log("🐛 BeingCreateModal - handleSubmit called with data:", data);
		console.log("🐛 BeingCreateModal - form errors:", methods.formState.errors);

		// Generate ID only when creating new being (empty ID)
		const finalData: InsertBeing = {
			...data,
			id: data.id || `@new-being-${Math.random().toString(36).substring(2, 8)}`,
		};

		console.log("🐛 BeingCreateModal - finalData:", finalData);
		console.log("🐛 BeingCreateModal - session:", session);
		console.log("🐛 BeingCreateModal - session.user:", session?.user);

		try {
			console.log("🐛 BeingCreateModal - calling createBeing.mutate...");
			console.log("🐛 BeingCreateModal - mutation status:", {
				isPending: createBeing.isPending,
				isError: createBeing.isError,
				error: createBeing.error,
			});

			const result = await createBeing.mutateAsync(finalData);
			console.log("🐛 BeingCreateModal - mutation success:", result);
		} catch (error) {
			console.error("🔥 BeingCreateModal - mutation error:", error);
			console.error("🔥 BeingCreateModal - mutation error details:", {
				message: error instanceof Error ? error.message : "Unknown error",
				stack: error instanceof Error ? error.stack : undefined,
				cause: error instanceof Error ? error.cause : undefined,
			});
		}
	};

	const handleCancel = useCallback(() => {
		onClose();
	}, [onClose]);

	if (!isOpen) return null;

	const typeDisplayName =
		(currentType as BeingType) || (defaultValues.type as BeingType) || "guest";
	const titleText = `Create New ${typeDisplayName === "space" ? "Space" : typeDisplayName === "bot" ? "Bot" : typeDisplayName === "document" ? "Document" : "Being"}`;

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
				<DialogContent className="flex max-h-[90vh] w-[95vw] max-w-5xl flex-col overflow-hidden">
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
