import {
	Anthropic,
	Baichuan,
	Cohere,
	DeepMind,
	DeepSeek,
	Gemini,
	Google,
	Groq,
	HuggingFace,
	Meta,
	Microsoft,
	Minimax,
	Mistral,
	Moonshot,
	Nvidia,
	OpenAI,
	OpenRouter,
	Perplexity,
	Qwen,
	Replicate,
	Together,
	Yi,
	Zhipu,
} from "@lobehub/icons";
import { ChevronDown, Eye, Volume2, Wrench, Zap } from "lucide-react";
import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "~/components/ui/command";
import { Label } from "~/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { useModels } from "~/hooks/use-models";
import type {
	ModelCapability,
	ModelSelectProps,
	ModelSummary,
} from "~/lib/types/llm";
import { cn } from "~/lib/utils";
import { EntitySkeleton } from "../../packages/entity-kit/src/components/ui/EntitySkeleton";
import { ResponsiveShell } from "../../packages/entity-kit/src/components/ui/ResponsiveShell";

// Format cost per million tokens with in/out labels
function formatCost(cost: number, label: "in" | "out"): string {
	if (cost === 0) return "FREE";

	// Handle negative costs (indicating free or special pricing)
	if (cost < 0) return "FREE";

	let formattedCost: string;
	if (cost < 1) {
		formattedCost = cost.toFixed(3);
	} else if (cost < 10) {
		formattedCost = cost.toFixed(2);
	} else {
		formattedCost = cost.toFixed(1);
	}

	// Trim trailing zeros after decimal point
	formattedCost = formattedCost.replace(/\.?0+$/, "");

	return `${label} $${formattedCost}/M`;
}

// Check if model is free
function isFreeModel(model: ModelSummary): boolean {
	return model.inputCost <= 0 && model.outputCost <= 0;
}

// Get provider icon component
function getProviderIcon(provider: string): React.ReactNode {
	const iconProps = { className: "h-6 w-6" };

	switch (provider.toLowerCase()) {
		case "openai":
			return <OpenAI {...iconProps} />;
		case "anthropic":
			return <Anthropic {...iconProps} />;
		case "meta":
		case "meta-llama":
			return <Meta {...iconProps} />;
		case "google":
			return <Google {...iconProps} />;
		case "gemini":
			return <Gemini {...iconProps} />;
		case "mistral":
		case "mistralai":
			return <Mistral {...iconProps} />;
		case "cohere":
			return <Cohere {...iconProps} />;
		case "huggingface":
			return <HuggingFace {...iconProps} />;
		case "replicate":
			return <Replicate {...iconProps} />;
		case "together":
		case "togetherai":
			return <Together {...iconProps} />;
		case "groq":
			return <Groq {...iconProps} />;
		case "perplexity":
			return <Perplexity {...iconProps} />;
		case "openrouter":
			return <OpenRouter {...iconProps} />;
		case "deepseek":
			return <DeepSeek {...iconProps} />;
		case "qwen":
			return <Qwen {...iconProps} />;
		case "baichuan":
			return <Baichuan {...iconProps} />;
		case "yi":
		case "01-ai":
			return <Yi {...iconProps} />;
		case "zhipu":
		case "zhipuai":
			return <Zhipu {...iconProps} />;
		case "moonshot":
			return <Moonshot {...iconProps} />;
		case "minimax":
			return <Minimax {...iconProps} />;
		case "deepmind":
			return <DeepMind {...iconProps} />;
		case "microsoft":
			return <Microsoft {...iconProps} />;
		case "nvidia":
			return <Nvidia {...iconProps} />;
		default:
			return (
				<div className="flex h-6 w-6 items-center justify-center rounded bg-muted font-medium text-xs">
					{provider.slice(0, 2).toUpperCase()}
				</div>
			);
	}
}

// Format context length
function formatContext(length: number): string {
	if (length >= 1_000_000) return `${(length / 1_000_000).toFixed(1)}M`;
	if (length >= 1_000) return `${(length / 1_000).toFixed(0)}K`;
	return length.toString();
}

// Capability icons with tooltips (in canonical order)
const capabilityConfig: Record<
	ModelCapability,
	{ icon: React.ReactNode; label: string; description: string }
> = {
	reasoning: {
		icon: <Zap className="h-3 w-3" />,
		label: "Reasoning",
		description: "Advanced reasoning and problem-solving capabilities",
	},
	tools: {
		icon: <Wrench className="h-3 w-3" />,
		label: "Tools",
		description: "Supports function calling and tool usage",
	},
	audio: {
		icon: <Volume2 className="h-3 w-3" />,
		label: "Audio",
		description: "Can process and generate audio content",
	},
	vision: {
		icon: <Eye className="h-3 w-3" />,
		label: "Vision",
		description: "Can analyze and understand images",
	},
};

// Model display component
function ModelDisplay({
	model,
	isCompact,
}: { model: ModelSummary; isCompact?: boolean }) {
	const modelIsFree = isFreeModel(model);

	return (
		<div className={cn("flex items-center gap-3", isCompact ? "h-12" : "h-16")}>
			<div className="flex h-8 w-8 items-center justify-center">
				{getProviderIcon(model.provider)}
			</div>

			<div className="flex flex-1 flex-col overflow-hidden">
				<div className="flex items-center gap-2">
					<span className="truncate font-medium text-foreground">
						{model.name}
					</span>
					{modelIsFree && (
						<Badge
							variant="default"
							className="h-5 bg-green-500 px-2 text-white text-xs hover:bg-green-600"
						>
							FREE
						</Badge>
					)}
					{model.capabilities.map((cap) => (
						<TooltipProvider key={cap}>
							<Tooltip>
								<TooltipTrigger asChild>
									<Badge variant="secondary" className="h-5 px-1.5 text-xs">
										{capabilityConfig[cap].icon}
									</Badge>
								</TooltipTrigger>
								<TooltipContent>
									<p>
										<strong>{capabilityConfig[cap].label}</strong>
									</p>
									<p className="text-muted-foreground text-xs">
										{capabilityConfig[cap].description}
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					))}
				</div>

				{!isCompact && (
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<span>{formatContext(model.contextLength)} ctx</span>
						{!modelIsFree && (
							<>
								<span>•</span>
								<span>
									{formatCost(model.inputCost, "in")} •{" "}
									{formatCost(model.outputCost, "out")}
								</span>
							</>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

// Multi-select capability filter component
function CapabilityFilter({
	value,
	onChange,
}: {
	value: ModelCapability[];
	onChange: (capabilities: ModelCapability[]) => void;
}) {
	const [open, setOpen] = useState(false);

	const toggleCapability = (capability: ModelCapability) => {
		if (value.includes(capability)) {
			onChange(value.filter((cap) => cap !== capability));
		} else {
			onChange([...value, capability]);
		}
	};

	const displayText =
		value.length === 0
			? "All capabilities"
			: value.length === 1
				? capabilityConfig[value[0] as string].label
				: `${value.length} capabilities`;

	return (
		<div className="flex items-center gap-2">
			<Label className="shrink-0 font-medium text-xs">Capabilities:</Label>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className="h-8 min-w-[120px] justify-between font-normal text-xs"
					>
						{displayText}
						<ChevronDown className="ml-2 h-3 w-3 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-56 p-2" align="start">
					<div className="space-y-2">
						{(Object.keys(capabilityConfig) as ModelCapability[]).map(
							(capability) => (
								<label
									key={capability}
									className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
								>
									<input
										type="checkbox"
										checked={value.includes(capability)}
										onChange={() => toggleCapability(capability)}
										className="h-3 w-3"
									/>
									<span className="flex items-center gap-1">
										{capabilityConfig[capability].icon}
										{capabilityConfig[capability].label}
									</span>
								</label>
							),
						)}
						{value.length > 0 && (
							<>
								<div className="my-1 border-t" />
								<Button
									variant="ghost"
									size="sm"
									onClick={() => onChange([])}
									className="h-7 w-full text-muted-foreground text-xs"
								>
									Clear selection
								</Button>
							</>
						)}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}

function SortByFilter({
	value,
	onChange,
}: {
	value: "price" | "name";
	onChange: (sortBy: "price" | "name") => void;
}) {
	return (
		<div className="flex items-center gap-2">
			<Label className="shrink-0 font-medium text-xs">Sort:</Label>
			<Select
				value={value}
				onValueChange={(val) => onChange(val as "price" | "name")}
			>
				<SelectTrigger className="h-8 text-xs">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="price">Price</SelectItem>
					<SelectItem value="name">Name</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}

// Model select panel
function ModelSelectPanel({
	value,
	onSelect,
	models,
	isLoading,
	isError,
	isEmpty,
	onSearchChange,
	filtersNode,
}: {
	value?: string;
	onSelect: (id: string) => void;
	models: ModelSummary[];
	isLoading: boolean;
	isError: boolean;
	isEmpty: boolean;
	onSearchChange: (search: string) => void;
	filtersNode?: React.ReactNode;
}) {
	return (
		<Command className="h-full w-full">
			<div className="flex items-center border-b px-3" cmdk-input-wrapper="">
				<CommandInput
					placeholder="Search models..."
					onValueChange={onSearchChange}
				/>
			</div>
			{filtersNode && (
				<div className="flex items-center gap-4 border-b px-3 py-2">
					{filtersNode}
				</div>
			)}
			<CommandList className="flex-1">
				{isLoading && models.length === 0 ? (
					<div className="p-2">
						<EntitySkeleton />
						<EntitySkeleton />
						<EntitySkeleton />
					</div>
				) : isError ? (
					<CommandEmpty>Error loading models. Please try again.</CommandEmpty>
				) : isEmpty ? (
					<CommandEmpty>No models found.</CommandEmpty>
				) : (
					models.map((model) => (
						<CommandItem
							key={model.id}
							value={model.id}
							onSelect={() => onSelect(model.id)}
							className="p-2 aria-selected:bg-accent aria-selected:text-accent-foreground"
						>
							<ModelDisplay model={model} />
						</CommandItem>
					))
				)}
			</CommandList>
		</Command>
	);
}

// Main model selector component
export function ModelSelector({
	value,
	onValueChange,
	placeholder = "Select model...",
}: ModelSelectProps) {
	const [open, setOpen] = useState(false);
	const {
		models,
		allModels,
		isLoading,
		isError,
		query,
		setQuery,
		selectedCapabilities,
		setSelectedCapabilities,
		sortBy,
		setSortBy,
	} = useModels();

	const selectedModel = allModels.find((model) => model.id === value);

	const handleSelect = (id: string) => {
		onValueChange?.(id);
		setOpen(false);
	};

	const filtersNode = (
		<>
			<CapabilityFilter
				value={selectedCapabilities}
				onChange={setSelectedCapabilities}
			/>
			<SortByFilter value={sortBy} onChange={setSortBy} />
		</>
	);

	return (
		<ResponsiveShell
			open={open}
			onOpenChange={setOpen}
			trigger={
				<button
					type="button"
					className={cn(
						"flex h-16 w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-md border bg-transparent p-2 text-left text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
						!value && "text-muted-foreground",
					)}
					role="combobox"
					aria-expanded={open}
					aria-controls="model-select-panel"
					aria-haspopup="listbox"
				>
					{selectedModel ? (
						<ModelDisplay model={selectedModel} isCompact />
					) : (
						placeholder
					)}
					<ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</button>
			}
			panel={
				<ModelSelectPanel
					value={value}
					onSelect={handleSelect}
					models={models}
					isLoading={isLoading}
					isError={isError}
					isEmpty={models.length === 0 && !isLoading && !isError}
					onSearchChange={setQuery}
					filtersNode={filtersNode}
				/>
			}
		/>
	);
}

// Form field wrapper
export function ModelSelectField({
	name,
	placeholder,
}: {
	name: string;
	placeholder?: string;
}) {
	const { control } = useFormContext();

	return (
		<Controller
			name={name}
			control={control}
			render={({ field }) => (
				<ModelSelector
					value={field.value}
					onValueChange={field.onChange}
					placeholder={placeholder}
				/>
			)}
		/>
	);
}
