// Central ID type definitions for the rhiz.om application
// These types can be used on both client and server

import { z } from "zod/v4";

/** A Being's canonical identifier */
export type BeingId = `@${string}` | `/${string}`;

/** An Intention's identifier – **always** begins with `/` */
export type IntentionId = `/${string}`;

// Type guards for runtime checking
export function isBeingId(value: string): value is BeingId {
	return value.startsWith("@") || value.startsWith("/");
}

export function isIntentionId(value: string): value is IntentionId {
	return value.startsWith("/");
}

// Zod schemas using the type guards
export const beingIdSchema = z.string().refine(isBeingId, {
	message: "BeingId must start with '@' or '/'",
}) as z.ZodType<BeingId>;

export const intentionIdSchema = z.string().refine(isIntentionId, {
	message: "IntentionId must start with '/'",
}) as z.ZodType<IntentionId>;

// Type assertion helpers for safe casting (keep for compatibility)
export function asBeingId(value: string): BeingId {
	if (!isBeingId(value)) {
		throw new Error(`Invalid BeingId: ${value} must start with '@' or '/'`);
	}
	return value;
}

export function asIntentionId(value: string): IntentionId {
	if (!isIntentionId(value)) {
		throw new Error(`Invalid IntentionId: ${value} must start with '/'`);
	}
	return value;
}

// Safe casting for nullable values
export function asBeingIdOrNull(value: string | null): BeingId | null {
	return value ? asBeingId(value) : null;
}

export function asBeingIdOrUndefined(
	value: string | undefined,
): BeingId | undefined {
	return value ? asBeingId(value) : undefined;
}
