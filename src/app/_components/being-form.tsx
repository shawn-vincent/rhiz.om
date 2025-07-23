import { useEffect } from "react";
import { Controller, useFormContext } from "react-hook-form";
import type { z } from "zod/v4";

import { BeingSelectField } from "~/components/being-selector";
import { ModelSelectField } from "~/components/model-selector";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";

import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";

import type { insertBeingSchema } from "~/server/db/types";

/* ---------- Types ---------- */
type BeingFormData = z.infer<typeof insertBeingSchema>;

export function BeingForm() {
	const {
		control,
		register,
		watch,
		formState: { errors },
	} = useFormContext<BeingFormData>();

	// Watch the type field to conditionally show bot fields
	const currentType = watch("type");

	// Debug logging
	console.log("🐛 BeingForm - currentType from watch:", currentType);

	/* ---------- render ---------- */
	return (
		<div className="space-y-6">
			{/* ----- Simple scalars ----- */}
			<div className="space-y-4">
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<Label htmlFor="id">ID</Label>
						<Input id="id" placeholder="@new-being" {...register("id")} readOnly />
						{errors.id && (
							<p className="text-red-600 text-sm">{errors.id.message}</p>
						)}
					</div>

					<div>
						<Label htmlFor="name">Name</Label>
						<Input id="name" placeholder="Soulspace" {...register("name")} />
						{errors.name && (
							<p className="text-red-600 text-sm">{errors.name.message}</p>
						)}
					</div>
				</div>

				<div>
					<Label htmlFor="type">Type</Label>
					<select
						id="type"
						className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						{...register("type")}
					>
						<option value="">Choose type</option>
						<option value="guest">guest</option>
						<option value="space">space</option>
						<option value="document">document</option>
						<option value="bot">bot</option>
					</select>
					{errors.type && (
						<p className="text-red-600 text-sm">{errors.type.message}</p>
					)}
				</div>

				<div>
					<Label htmlFor="ownerId">Owner ID</Label>
					<BeingSelectField name="ownerId" />
					{errors.ownerId && (
						<p className="text-red-600 text-sm">{errors.ownerId.message}</p>
					)}
				</div>

				<div>
					<Label htmlFor="locationId">Location ID</Label>
					<BeingSelectField name="locationId" />
					{errors.locationId && (
						<p className="text-red-600 text-sm">{errors.locationId.message}</p>
					)}
				</div>
			</div>

			{/* Bot-specific fields - only show for bot type */}
			{currentType === "bot" && (
				<>
					<Separator />
					<div className="space-y-4">
						<h3 className="font-medium text-lg">Bot Configuration</h3>

						<div>
							<Label htmlFor="botModel">Bot Model</Label>
							<ModelSelectField
								name="botModel"
								placeholder="Select an AI model..."
							/>
							{errors.botModel && (
								<p className="text-red-600 text-sm">
									{errors.botModel.message}
								</p>
							)}
						</div>

						<div>
							<Label htmlFor="botPrompt">Bot System Prompt</Label>
							<p className="mb-2 text-muted-foreground text-sm">
								Define the bot's personality, instructions, and behavior.
								Supports Markdown formatting.
							</p>
							<Controller
								control={control}
								name="botPrompt"
								render={({ field }) => (
									<CodeMirror
										basicSetup={{
											lineNumbers: true,
											foldGutter: true,
											dropCursor: false,
											allowMultipleSelections: false,
											indentOnInput: true,
											bracketMatching: true,
											closeBrackets: true,
											autocompletion: true,
											highlightSelectionMatches: true,
										}}
										extensions={[markdown(), EditorView.lineWrapping]}
										theme={oneDark}
										minHeight="200px"
										maxHeight="600px"
										value={field.value ?? ""}
										onChange={(value) => field.onChange(value)}
										placeholder="You are a helpful assistant. Your role is to..."
									/>
								)}
							/>
							{errors.botPrompt && (
								<p className="text-red-600 text-sm">
									{errors.botPrompt.message}
								</p>
							)}
						</div>
						<div>
                            <Label htmlFor="llmApiKey">OpenRouter API Key</Label>
                            <p className="mb-2 text-muted-foreground text-sm">
                                Optional. If provided, this key will be used for all LLM calls
                                instead of the system-wide key. Get one from the{' '}
                                <a
                                    href="https://openrouter.ai/keys"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                >
                                    OpenRouter website
                                </a>
                                .
                            </p>
                            <PasswordField
                                id="llmApiKey"
                                placeholder="sk-or-..."
                                {...register('llmApiKey')}
                            />
                            {errors.llmApiKey && (
                                <p className="text-red-600 text-sm">
                                    {errors.llmApiKey.message}
                                </p>
                            )}
                        </div>
					</div>
				</>
			)}

		</div>
	);
}
