export interface ModelProvider {
	id: string;
	name: string;
	description?: string;
	website?: string;
	iconUrl?: string;
}

export interface ModelPricing {
	prompt: string;
	completion: string;
	request?: string;
	image?: string;
}

export interface ModelTopProvider {
	context_length: number;
	max_completion_tokens?: number;
	is_moderated: boolean;
}

export interface Model {
	id: string;
	object: string;
	created: number;
	owned_by: string;
	name: string;
	description?: string;
	context_length: number;
	architecture: {
		modality: string;
		tokenizer: string;
		instruct_type?: string;
	};
	pricing: ModelPricing;
	top_provider: ModelTopProvider;
	per_request_limits?: {
		prompt_tokens: string;
		completion_tokens: string;
	};
}

export interface ModelSummary {
	id: string;
	name: string;
	provider: string;
	contextLength: number;
	inputCost: number;
	outputCost: number;
	capabilities: ModelCapability[];
	isModerated: boolean;
}

export type ModelCapability = "reasoning" | "tools" | "audio" | "vision";

export interface ModelSelectProps {
	value?: string;
	onValueChange?: (value: string) => void;
	placeholder?: string;
}
