"use client";

import { useCallback } from "react";
import { FormProvider } from "react-hook-form";
import { toast } from "sonner";
import { BeingForm } from "~/app/_components/being-form";
import { Avatar } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { ResponsiveModal } from "~/components/ui/responsive-modal";
import { useBeing } from "~/hooks/use-being-cache";
import { useBeingForm } from "~/hooks/use-being-form";
import type { BeingFormData } from "~/hooks/use-being-form";
import { api } from "~/trpc/react";
import type { BeingType } from "../../packages/entity-kit/src/types";

interface BeingEditModalProps {
	beingId: string | null;
	isOpen: boolean;
	onClose: () => void;
	onSaved?: () => void;
}

export function BeingEditModal({
	beingId,
	isOpen,
	onClose,
	onSaved,
}: BeingEditModalProps) {
	const utils = api.useUtils();

	const { data: being, isLoading } = useBeing(beingId ?? undefined, {
		enabled: !!beingId && isOpen,
	});

	// Use the custom form hook
	const { methods, currentType, prepareSubmitData } = useBeingForm({
		being,
		isOpen,
	});

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

	const handleSubmit = async (data: BeingFormData) => {
		const finalData = prepareSubmitData(data);
		await upsertBeing.mutate(finalData);
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

	return (
		<ResponsiveModal
			isOpen={isOpen}
			onClose={onClose}
			title={
				<>
					<Avatar
						beingId={being?.id || "@new-being"}
						beingType={typeDisplayName}
						size="md"
						className="h-8 w-8"
					/>
					{titleText}
				</>
			}
		>
			{content}
		</ResponsiveModal>
	);
}
