import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useDeferredValue } from "react";
import type { Model, ModelCapability, ModelSummary } from "~/lib/types/llm";

// Transform OpenRouter API response to our ModelSummary format
function transformModel(model: Model): ModelSummary {
	const provider = model.owned_by || model.id.split("/")[0] || "unknown";

	// Parse costs, treating negative values as free (some models like Auto Router have negative pricing)
	const rawInputCost = Number.parseFloat(model.pricing.prompt || "0");
	const rawOutputCost = Number.parseFloat(model.pricing.completion || "0");

	// Convert to cost per million tokens, treating negative as 0 (free)
	const inputCost = rawInputCost < 0 ? 0 : rawInputCost * 1_000_000;
	const outputCost = rawOutputCost < 0 ? 0 : rawOutputCost * 1_000_000;

	const capabilities: ModelCapability[] = [];

	// Check capabilities in canonical order: reasoning, tools, audio, vision
	if (
		model.description?.toLowerCase().includes("reasoning") ||
		model.description?.toLowerCase().includes("o1")
	) {
		capabilities.push("reasoning");
	}
	if (
		model.description?.toLowerCase().includes("tool") ||
		model.description?.toLowerCase().includes("function")
	) {
		capabilities.push("tools");
	}
	if (model.architecture.modality.includes("audio")) {
		capabilities.push("audio");
	}
	if (
		model.architecture.modality.includes("image") ||
		model.architecture.modality.includes("vision")
	) {
		capabilities.push("vision");
	}

	// Sort capabilities in canonical order for consistent display
	const canonicalOrder: ModelCapability[] = [
		"reasoning",
		"tools",
		"audio",
		"vision",
	];
	const sortedCapabilities = canonicalOrder.filter((cap) =>
		capabilities.includes(cap),
	);

	return {
		id: model.id,
		name: model.name,
		provider,
		contextLength: model.context_length,
		inputCost,
		outputCost,
		capabilities: sortedCapabilities,
		isModerated: model.top_provider.is_moderated,
	};
}

async function fetchModels(): Promise<ModelSummary[]> {
	const response = await fetch("https://openrouter.ai/api/v1/models", {
		headers: {
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch models: ${response.statusText}`);
	}

	const data = await response.json();
	return data.data.map(transformModel);
}

export function useModels() {
	const [query, setQuery] = useState("");
	const [selectedCapabilities, setSelectedCapabilities] = useState<
		ModelCapability[]
	>([]);
	const [sortBy, setSortBy] = useState<"price" | "name">("price");

	const deferredQuery = useDeferredValue(query);

	const {
		data: allModels = [],
		isLoading,
		isError,
	} = useQuery({
		queryKey: ["openrouter-models"],
		queryFn: fetchModels,
		staleTime: 1000 * 60 * 60, // 1 hour
		gcTime: 1000 * 60 * 60 * 6, // 6 hours
		refetchOnWindowFocus: false,
	});

	// Filter and search models
	const filteredModels = useMemo(() => {
		let filtered = allModels;

		// Filter by selected capabilities (must have ALL selected capabilities)
		if (selectedCapabilities.length > 0) {
			filtered = filtered.filter((model) =>
				selectedCapabilities.every((cap) => model.capabilities.includes(cap)),
			);
		}

		// Search by name or ID
		if (deferredQuery) {
			const lowerQuery = deferredQuery.toLowerCase();
			filtered = filtered.filter(
				(model) =>
					model.name.toLowerCase().includes(lowerQuery) ||
					model.id.toLowerCase().includes(lowerQuery) ||
					model.provider.toLowerCase().includes(lowerQuery),
			);
		}

		// Sort by selected criteria
		if (sortBy === "price") {
			return filtered.sort((a, b) => {
				// Free models first
				const aFree = a.inputCost === 0 && a.outputCost === 0;
				const bFree = b.inputCost === 0 && b.outputCost === 0;
				if (aFree && !bFree) return -1;
				if (!aFree && bFree) return 1;
				// Then by output cost (primary pricing metric)
				return a.outputCost - b.outputCost;
			});
		} else {
			return filtered.sort((a, b) => a.name.localeCompare(b.name));
		}
	}, [allModels, selectedCapabilities, sortBy, deferredQuery]);

	return {
		models: filteredModels,
		allModels,
		isLoading,
		isError,
		query,
		setQuery,
		selectedCapabilities,
		setSelectedCapabilities,
		sortBy,
		setSortBy,
	};
}
