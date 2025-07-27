import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { DrizzleDB } from "~/server/db";
import { intentions, users } from "~/server/db/schema";
import type { BeingId, IntentionId, Intention, InsertIntention } from "~/server/db/types";
import { selectIntentionSchema } from "~/server/db/types";
import { activateBots } from "~/server/lib/bots";
import { logger } from "~/server/lib/logger";
import type { Session } from "next-auth";

const intentionLogger = logger.child({ name: "IntentionService" });

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
  async createUtterance(input: CreateUtteranceInput, session: Session): Promise<{ success: boolean }> {
    const userRecord = await this.db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });
    
    if (!userRecord?.beingId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User does not have an associated Being.",
      });
    }

    const userIntentionId: IntentionId = `/${crypto.randomUUID()}`;
    
    await this.db.insert(intentions).values({
      id: userIntentionId,
      name: `Utterance by ${session.user.name ?? "user"}`,
      type: "utterance",
      state: "complete",
      ownerId: userRecord.beingId,
      locationId: input.beingId,
      content: [input.content],
    });

    // Activate all bots in the space (fire and forget)
    activateBots(input.beingId as BeingId, userIntentionId).catch((error) =>
      intentionLogger.error({ error }, "Bot activation failed"),
    );

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
    actorId: BeingId
  ): Promise<Intention> {
    // For now, simple implementation - could add authorization logic here
    const existing = await this.getIntention(id);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Intention with ID "${id}" not found.`,
      });
    }

    await this.db
      .update(intentions)
      .set({
        ...updates,
        modifiedAt: new Date(),
      })
      .where(eq(intentions.id, id));

    const updated = await this.getIntention(id);
    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update intention",
      });
    }

    return updated;
  }
}