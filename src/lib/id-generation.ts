// Central ID generation service for BeingId and IntentionId
import type { BeingId, IntentionId } from "./types";

/**
 * Generate a new BeingId with the format @{uuid}
 */
export function generateBeingId(): BeingId {
	return `@${crypto.randomUUID()}`;
}

/**
 * Generate a new IntentionId with the format /{uuid}
 */
export function generateIntentionId(): IntentionId {
	return `/${crypto.randomUUID()}`;
}

/**
 * Generate a BeingId with a custom prefix (for spaces, documents, etc.)
 */
export function generateBeingIdWithPrefix(prefix: string): BeingId {
	return `@${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Generate an IntentionId with a custom prefix (for different intention types)
 */
export function generateIntentionIdWithPrefix(prefix: string): IntentionId {
	return `/${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
