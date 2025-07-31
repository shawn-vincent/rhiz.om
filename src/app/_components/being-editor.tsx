import { zodResolver } from "@hookform/resolvers/zod";
// src/app/_components/being-editor.tsx
import { useEffect } from "react";
import {
	type DefaultValues,
	FormProvider,
	type Resolver,
	type SubmitHandler,
	useForm,
} from "react-hook-form";
import type { z } from "zod/v4";

import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";
import ErrorBoundary from "~/components/ui/error-boundary";
import { useBeing } from "~/hooks/use-beings";
import { logger } from "~/lib/logger.client";
import type { BeingId } from "~/lib/types";
import {
	type Being,
	type InsertBeing,
	insertBeingSchema,
} from "~/server/db/types";
import { api } from "~/trpc/react";
import { BeingForm } from "./being-form";

const beingEditorLogger = logger.child({ name: "BeingEditor" });

interface BeingEditorProps {
	beingId: BeingId;
}

type BeingFormData = z.infer<typeof insertBeingSchema>;

export function BeingEditor({ beingId }: BeingEditorProps) {
	const utils = api.useUtils();

	const { data: being, isLoading, error } = useBeing(beingId);

	const upsertBeing = api.being.upsert.useMutation({
		onSuccess: async () => {
			await utils.being.getById.invalidate({ id: beingId });
			await utils.being.getAll.invalidate();
		},
		onError: (err) => {
			beingEditorLogger.error(err, `Failed to save being: ${err.message}`);
		},
	});

	const baseDefaults: DefaultValues<BeingFormData> = {
		id: "@new-being",
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

	const methods = useForm<BeingFormData>({
		resolver: zodResolver(insertBeingSchema) as Resolver<BeingFormData>,
		defaultValues: baseDefaults,
	});

	useEffect(() => {
		if (being) {
			const formValues: BeingFormData = {
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
			methods.reset(formValues);
		}
	}, [being, methods]);

	const submit: SubmitHandler<BeingFormData> = async (data) => {
		await upsertBeing.mutate(data);
	};

	if (isLoading) {
		return <div className="p-4 text-center text-white/70">Loading...</div>;
	}

	if (error) {
		return (
			<div className="p-4 text-center text-red-400">Error: {error.message}</div>
		);
	}

	return (
		<ErrorBoundary>
			<FormProvider {...methods}>
				<form
					onSubmit={methods.handleSubmit(submit)}
					className="flex h-full flex-col"
				>
					<div className="flex-grow overflow-y-auto p-4">
						<BeingForm />
					</div>
					<DialogFooter className="p-4">
						<Button type="submit" disabled={methods.formState.isSubmitting}>
							{methods.formState.isSubmitting ? "Saving…" : "Save Being"}
						</Button>
					</DialogFooter>
				</form>
			</FormProvider>
		</ErrorBoundary>
	);
}
