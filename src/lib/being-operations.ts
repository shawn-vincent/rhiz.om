import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { AuthContext } from "~/domain/auth-service";
import { emitter } from "~/lib/events";
import { canEdit } from "~/lib/permissions";
import type { DrizzleDB } from "~/server/db";
import { beings, intentions } from "~/server/db/schema";
import {
	insertBeingSchema,
	insertIntentionSchema,
	selectBeingSchema,
	selectIntentionSchema,
} from "~/server/db/types";
import type {
	Being,
	BeingId,
	InsertBeing,
	InsertIntention,
	Intention,
	IntentionId,
} from "~/server/db/types";
import { activateBots } from "~/server/lib/bots";
import { broadcastSyncEvent } from "~/server/lib/livekit";

export interface UpdateBeingInput extends Partial<InsertBeing> {
	id: string;
}

export interface CreateIntentionInput
	extends Omit<InsertIntention, "modifiedAt" | "createdAt"> {}

export interface UpdateIntentionInput extends Partial<CreateIntentionInput> {
	id: string;
}

/**
 * Create a new being with authorization, database insert, and sync notifications
 */
export async function createBeing(
	db: DrizzleDB,
	input: InsertBeing,
	auth: AuthContext,
): Promise<Being> {
	const { sessionBeingId, isCurrentUserSuperuser } = auth;

	// Authorization: Check if user can create this being
	if (!canEdit(sessionBeingId, input.ownerId, isCurrentUserSuperuser)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `You can only create beings that you own or have superuser access to [Tried to create ${input.id} owned by ${input.ownerId || "UNDEFINED"}, you=${sessionBeingId || "UNDEFINED"}, superuser=${isCurrentUserSuperuser}.]`,
		});
	}

	// Validate input
	const validatedInput = insertBeingSchema.parse(input);

	// Database insert
	const result = await db
		.insert(beings)
		.values({
			...validatedInput,
			modifiedAt: new Date(),
		})
		.returning();

	if (!result[0]) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create being",
		});
	}

	const newBeing = selectBeingSchema.parse(result[0]);

	// Sync notification - new being created
	if (input.locationId) {
		broadcastSyncEvent(input.locationId, {
			type: "being-created",
			data: { id: input.id },
			timestamp: new Date().toISOString(),
		});
	}

	// Bot location change event for server-side agents
	if (input.type === "bot") {
		emitter.emit("bot-location-change", {
			beingId: input.id,
			spaceId: input.locationId,
			oldSpaceId: null,
		});
	}

	return newBeing;
}

/**
 * Update an existing being with authorization, database upsert, and sync notifications
 */
export async function updateBeing(
	db: DrizzleDB,
	input: UpdateBeingInput,
	auth: AuthContext,
): Promise<Being> {
	const { sessionBeingId, isCurrentUserSuperuser } = auth;

	// Authorization: Check if user can edit this being
	if (!canEdit(sessionBeingId, input.ownerId, isCurrentUserSuperuser)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `You can only save beings that you own or have superuser access to [Tried to modify ${input.id} owned by ${input.ownerId || "UNDEFINED"}, you=${sessionBeingId || "UNDEFINED"}, superuser=${isCurrentUserSuperuser}.]`,
		});
	}

	// Check if locationId changed to broadcast presence update
	const existingBeing = await db.query.beings.findFirst({
		where: eq(beings.id, input.id),
	});

	// Validate input for upsert
	const upsertData = insertBeingSchema.parse(input);

	// Use Drizzle's ON CONFLICT for an atomic upsert operation
	const result = await db
		.insert(beings)
		.values({
			...upsertData,
			modifiedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: beings.id,
			set: {
				...upsertData,
				modifiedAt: new Date(),
			},
		})
		.returning();

	if (!result[0]) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create or update being",
		});
	}

	const updatedBeing = selectBeingSchema.parse(result[0]);

	// Sync notifications
	if (!existingBeing) {
		// New being created - notify the space they're joining
		if (input.locationId) {
			broadcastSyncEvent(input.locationId, {
				type: "being-created",
				data: { id: input.id },
				timestamp: new Date().toISOString(),
			});
		}
	} else {
		// Being updated - notify both old and new spaces if location changed
		const oldSpaceId = existingBeing.locationId;
		const newSpaceId = input.locationId;

		if (oldSpaceId && oldSpaceId !== newSpaceId) {
			// Notify old space that being left
			broadcastSyncEvent(oldSpaceId, {
				type: "being-updated",
				data: { id: input.id },
				timestamp: new Date().toISOString(),
			});
		}

		if (newSpaceId) {
			// Notify new space that being joined/updated
			broadcastSyncEvent(newSpaceId, {
				type: "being-updated",
				data: { id: input.id },
				timestamp: new Date().toISOString(),
			});
		}
	}

	// Emit bot location change event for server-side agents
	if (input.type === "bot") {
		emitter.emit("bot-location-change", {
			beingId: input.id,
			spaceId: input.locationId,
			oldSpaceId: existingBeing?.locationId || null,
		});
	}

	return updatedBeing;
}

/**
 * Create a new intention with database insert, sync notification, and side effects
 */
export async function createIntention(
	db: DrizzleDB,
	input: CreateIntentionInput,
	auth: AuthContext,
): Promise<Intention> {
	// Validate input
	const validatedInput = insertIntentionSchema.parse(input);

	// Database insert
	const result = await db
		.insert(intentions)
		.values({
			...validatedInput,
			modifiedAt: new Date(),
		})
		.returning();

	if (!result[0]) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create intention",
		});
	}

	const newIntention = selectIntentionSchema.parse(result[0]);

	// Sync notification
	if (input.locationId) {
		broadcastSyncEvent(input.locationId, {
			type: "intention-created",
			data: { id: input.id },
			timestamp: new Date().toISOString(),
		});
	}

	// Activate bots if this is an utterance (fire and forget)
	if (input.type === "utterance" && input.locationId) {
		activateBots(input.locationId as BeingId, input.id as IntentionId).catch(
			() => {
				// Silently handle bot activation errors - they shouldn't block the main operation
			},
		);
	}

	return newIntention;
}

/**
 * Update an existing intention with database update and sync notification
 */
export async function updateIntention(
	db: DrizzleDB,
	input: UpdateIntentionInput,
	auth: AuthContext,
): Promise<Intention> {
	// Check if intention exists
	const existing = await db.query.intentions.findFirst({
		where: eq(intentions.id, input.id),
	});

	if (!existing) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: `Intention with ID "${input.id}" not found.`,
		});
	}

	// Database update
	await db
		.update(intentions)
		.set({
			...input,
			modifiedAt: new Date(),
		})
		.where(eq(intentions.id, input.id));

	// Fetch updated intention
	const result = await db.query.intentions.findFirst({
		where: eq(intentions.id, input.id),
	});

	if (!result) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to update intention",
		});
	}

	const updatedIntention = selectIntentionSchema.parse(result);

	// Sync notification
	if (updatedIntention.locationId) {
		broadcastSyncEvent(updatedIntention.locationId, {
			type: "intention-updated",
			data: { id: input.id },
			timestamp: new Date().toISOString(),
		});
	}

	return updatedIntention;
}
