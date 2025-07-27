"use client";

import { useCallback } from "react";
import { FormProvider } from "react-hook-form";
import { toast } from "sonner";
import { BeingForm } from "~/app/_components/being-form";
import { Avatar } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { ResponsiveModal } from "~/components/ui/responsive-modal";
import { useBeingForm } from "~/hooks/use-being-form";
import type { BeingFormData } from "~/hooks/use-being-form";
import type { BeingType } from "~/lib/space-types";
import { api } from "~/trpc/react";

interface BeingCreateModalProps {
	isOpen: boolean;
	onClose: () => void;
	onCreated?: (beingId: string) => void;
	defaultValues?: Partial<BeingFormData>;
}

export function BeingCreateModal({
	isOpen,
	onClose,
	onCreated,
	defaultValues = {},
}: BeingCreateModalProps) {
	const utils = api.useUtils();

	// Use the custom form hook
	const { methods, currentType, prepareSubmitData } = useBeingForm({
		defaultValues,
		isOpen,
	});

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

	const handleSubmit = async (data: BeingFormData) => {
		console.log("🐛 BeingCreateModal - handleSubmit called with data:", data);
		console.log("🐛 BeingCreateModal - form errors:", methods.formState.errors);

		const finalData = prepareSubmitData(data);
		console.log("🐛 BeingCreateModal - finalData:", finalData);

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
				onSubmit={methods.handleSubmit(handleSubmit)}
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

	return (
		<ResponsiveModal
			isOpen={isOpen}
			onClose={onClose}
			title={
				<>
					<Avatar
						beingId="@new-being"
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
