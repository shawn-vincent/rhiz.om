import type {
	BeingRequest,
	BeingResponse,
	IntentionRequest,
	IntentionResponse,
} from "~/lib/simple-sync-types";

// Simple API helpers
export async function callBeingAPI(
	request: BeingRequest,
): Promise<BeingResponse> {
	const response = await fetch("/api/beings", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});

	if (!response.ok) {
		throw new Error(`API call failed: ${response.statusText}`);
	}

	return response.json();
}

export async function callIntentionAPI(
	request: IntentionRequest,
): Promise<IntentionResponse> {
	const response = await fetch("/api/intentions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});

	if (!response.ok) {
		throw new Error(`API call failed: ${response.statusText}`);
	}

	return response.json();
}
