// src/app/being/[beingId]/edit/page.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { useEffect } from "react";
import {
	type DefaultValues,
	FormProvider,
	type Resolver,
	type SubmitHandler,
	useForm,
} from "react-hook-form";
import type { z } from "zod/v4";

import { BeingForm } from "~/app/_components/being-form";
import { MobileBreadcrumb } from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import ErrorBoundary from "~/components/ui/error-boundary";
import { logger } from "~/lib/logger.client";
import { type InsertBeing, insertBeingSchema } from "~/server/db/types";
import { api } from "~/trpc/react";

const beingEditorLogger = logger.child({ name: "BeingEditorPage" });

interface BeingEditPageProps {
	params: Promise<{ beingId: string }>;
}

type BeingFormData = z.infer<typeof insertBeingSchema>;

export default function BeingEditPage({ params }: BeingEditPageProps) {
	const resolvedParams = React.use(params);
	const beingId = decodeURIComponent(resolvedParams.beingId);
	const router = useRouter();
	const utils = api.useUtils();

	const {
		data: being,
		isLoading,
		error,
	} = api.being.getById.useQuery(
		{ id: beingId }, 
		{ 
			enabled: !!beingId,
			retry: false, // Don't retry if being doesn't exist
		}
	);

	const upsertBeing = api.being.upsert.useMutation({
		onSuccess: async () => {
			await utils.being.getById.invalidate({ id: beingId });
			await utils.being.getAll.invalidate();
			// Navigate back to being view after successful save
			router.push(`/being/${beingId}`);
		},
		onError: (err) => {
			beingEditorLogger.error(err, "Failed to save being: " + err.message);
		},
	});

	const baseDefaults: DefaultValues<BeingFormData> = {
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
	};

	const methods = useForm<BeingFormData>({
		resolver: zodResolver(insertBeingSchema) as Resolver<BeingFormData>,
		defaultValues: baseDefaults,
	});

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
			};
			methods.reset(formValues);
		}
	}, [being, methods]);

	const submit: SubmitHandler<BeingFormData> = async (data) => {
		await upsertBeing.mutate(data);
	};

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center space-y-4">
					<div className="text-destructive">Error: {error.message}</div>
					{error.data?.code === "NOT_FOUND" && (
						<div className="text-muted-foreground">
							The being with ID "{beingId}" does not exist.
						</div>
					)}
					<Link href="/">
						<Button variant="outline">Go Home</Button>
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full">
			{/* Mobile-first header with breadcrumb navigation */}
				<header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
					<div className="container mx-auto max-w-4xl flex h-mobile-touch items-center gap-mobile-gap px-4 sm:px-6 lg:px-8">
						<Link href={`/being/${beingId}`}>
							<Button
								variant="ghost"
								size="sm"
								className="shrink-0 p-2"
								aria-label="Back to being view"
							>
								<ArrowLeft className="size-4" />
								<span className="sr-only">Back</span>
							</Button>
						</Link>
						<MobileBreadcrumb
							items={[
								{
									label: being?.name || beingId,
									href: `/being/${beingId}`,
								},
								{
									label: "Edit",
									current: true,
								},
							]}
							className="flex-1 overflow-hidden"
						/>
					</div>
				</header>

				{/* Main content with mobile-optimized spacing */}
				<main className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
					<FormProvider {...methods}>
						<form onSubmit={methods.handleSubmit(submit)} className="space-y-6">
							<BeingForm />

							{/* Mobile-friendly action buttons */}
							<div className="sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 border-t bg-background/95 p-4 sm:p-6 lg:p-8 backdrop-blur supports-[backdrop-filter]:bg-background/60">
								<div className="flex gap-mobile-gap">
									<Button
										type="button"
										variant="outline"
										className="flex-1"
										onClick={() => router.push(`/being/${beingId}`)}
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
				</main>
		</div>
	);
}
