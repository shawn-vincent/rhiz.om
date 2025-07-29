import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { DrizzleDB } from "~/server/db";
import { intentions } from "~/server/db/schema";
import type {
	BeingId,
	InsertIntention,
	Intention,
	IntentionId,
} from "~/server/db/types";
import { selectIntentionSchema } from "~/server/db/types";
import type { AuthContext } from "./auth-service";

export interface CreateUtteranceInput {
	content: string;
	beingId: string;
}

export class IntentionService {
	constructor(private db: DrizzleDB) {}

	/**
	 * Get all utterances/intentions in a specific being (location)
	 */
	async getIntentionsInLocation(beingId: string): Promise<Intention[]> {
		const results = await this.db.query.intentions.findMany({
			where: eq(intentions.locationId, beingId),
			orderBy: (intentions, { asc }) => [asc(intentions.createdAt)],
		});
		return results.map((intention) => selectIntentionSchema.parse(intention));
	}

	/**
	 * Create a new utterance (chat message) from a user
	 */
	async createUtterance(
		input: CreateUtteranceInput,
		auth: AuthContext,
	): Promise<{ success: boolean }> {
		const userIntentionId: IntentionId = `/${crypto.randomUUID()}`;

		const { createIntention } = await import("~/lib/being-operations");

		await createIntention(
			this.db,
			{
				id: userIntentionId,
				name: `Utterance by ${auth.currentUser?.name ?? "user"}`,
				type: "utterance",
				state: "complete",
				ownerId: auth.sessionBeingId,
				locationId: input.beingId,
				content: [input.content],
			},
			auth,
		);

		// Activate all bots in the space (fire and forget) - only for user utterances
		const { activateBots } = await import("~/server/lib/bots");
		activateBots(input.beingId as BeingId, userIntentionId).catch(() => {
			// Silently handle bot activation errors - they shouldn't block the main operation
		});

		return { success: true };
	}

	/**
	 * Get a specific intention by ID
	 */
	async getIntention(id: string): Promise<Intention | null> {
		const result = await this.db.query.intentions.findFirst({
			where: eq(intentions.id, id),
		});
		return result ? selectIntentionSchema.parse(result) : null;
	}

	/**
	 * Update an intention (for bot responses, state changes, etc.)
	 */
	async updateIntention(
		id: string,
		updates: Partial<InsertIntention>,
		actorId: BeingId,
	): Promise<Intention> {
		const { updateIntention } = await import("~/lib/being-operations");

		return await updateIntention(
			this.db,
			{
				id,
				...updates,
			},
			{
				sessionBeingId: actorId,
				currentUser: null,
				isCurrentUserSuperuser: false,
			},
		);
	}
}
