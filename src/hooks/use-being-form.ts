import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { insertBeingSchema } from "~/server/db/types";
import type { Being, BeingId, InsertBeing } from "~/server/db/types";

// Custom schema for form that makes ID optional (will be generated on save)
const beingFormSchema = insertBeingSchema.extend({
	id: z.string().optional().default(""),
});

export type BeingFormData = z.infer<typeof beingFormSchema>;

interface UseBeingFormOptions {
	being?: Being | null;
	defaultValues?: Partial<BeingFormData>;
	isOpen?: boolean;
}

/**
 * Custom hook for being form management
 * Handles form setup, default values, and reset logic for both create and edit modals
 */
export function useBeingForm({
	being,
	defaultValues = {},
	isOpen = true,
}: UseBeingFormOptions = {}) {
	const { data: session } = useSession();

	// Create base defaults for create mode
	const baseDefaults: BeingFormData = useMemo(
		() => ({
			id: "", // ID will be generated on save for create mode
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
			llmApiKey: "",
			...defaultValues,
		}),
		[session?.user?.beingId, defaultValues],
	);

	// Create initial values for edit mode
	const getEditDefaults = (): BeingFormData => {
		if (being) {
			return {
				...being,
				ownerId: being.ownerId || undefined,
				locationId: being.locationId || undefined,
				extIds: being.extIds || undefined,
				idHistory: being.idHistory || undefined,
				metadata: being.metadata || undefined,
				properties: being.properties || undefined,
				content: being.content || undefined,
				botModel: being.botModel || undefined,
				botPrompt: being.botPrompt || undefined,
				llmApiKey: being.llmApiKey || undefined,
			};
		}
		return baseDefaults;
	};

	const initialValues = being ? getEditDefaults() : baseDefaults;

	const methods = useForm<BeingFormData>({
		resolver: zodResolver(beingFormSchema) as any,
		defaultValues: initialValues,
	});

	// Watch the type field to update UI elements reactively
	const currentType = methods.watch("type");

	// Reset form when modal opens or being data changes
	useEffect(() => {
		if (isOpen) {
			const valuesToUse = being ? getEditDefaults() : baseDefaults;
			methods.reset(valuesToUse);
		}
	}, [
		isOpen,
		being?.id,
		being?.name,
		being?.type,
		being?.ownerId,
		being?.locationId,
	]);

	// Helper function to prepare submission data
	const prepareSubmitData = (data: BeingFormData): InsertBeing => {
		if (being) {
			// Edit mode: use existing ID
			return { ...data, id: being.id };
		}
		// Create mode: generate ID if not provided
		return {
			...data,
			id: (data.id ||
				`@new-being-${Math.random().toString(36).substring(2, 8)}`) as BeingId,
		};
	};

	return {
		methods,
		currentType,
		prepareSubmitData,
		isEditMode: !!being,
		isCreateMode: !being,
	};
}
