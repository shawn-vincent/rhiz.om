import { Readable } from "stream";
import { observable } from "@trpc/server/observable";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import { emitter } from "~/lib/events";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { intentions, users } from "~/server/db/schema";
import { env } from "~/env";
import { type DrizzleDB } from "~/server/db";
import { TRPCError } from "@trpc/server";

const AI_AGENT_BEING_ID = "@rhiz.om-assistant";

// The core AI streaming logic remains the same.
async function streamAiResponse({
  db,
  userContent,
  beingId,
  aiIntentionId,
}: {
  db: DrizzleDB;
  userContent: string;
  beingId: string;
  aiIntentionId: string;
}) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Rhiz.om",
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [{ role: "user", content: userContent }],
        stream: true,
      }),
    });

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n\n").filter(line => line.startsWith("data: "));

      for (const line of lines) {
        const jsonStr = line.replace("data: ", "");
        if (jsonStr === "[DONE]") break;
        
        try {
          const parsed = JSON.parse(jsonStr);
          const token = parsed.choices[0]?.delta?.content;
          if (token) {
            fullResponse += token;
            emitter.emit(`update.${aiIntentionId}`, { type: "token", data: token });
          }
        } catch (error) {
          // Ignore parsing errors for non-json parts of the stream
        }
      }
    }

    await db
      .update(intentions)
      .set({
        content: [fullResponse],
        state: "complete",
        modifiedAt: new Date(),
      })
      .where(eq(intentions.id, aiIntentionId));

    emitter.emit(`update.${aiIntentionId}`, { type: "end" });

  } catch (error) {
    console.error("AI response generation failed:", error);
    emitter.emit(`update.${aiIntentionId}`, {
      type: "error",
      data: "Failed to get response from AI.",
    });
    await db
      .update(intentions)
      .set({ state: "failed", content: ["AI failed to respond."] })
      .where(eq(intentions.id, aiIntentionId));
  }
}


export const intentionRouter = createTRPCRouter({
  getAllUtterancesInBeing: publicProcedure
    .input(z.object({ beingId: z.string() }))
    .query(async ({ ctx, input }) => {
      // This procedure remains the same
      return ctx.db.query.intentions.findMany({
        where: eq(intentions.locationId, input.beingId),
        orderBy: (intentions, { asc }) => [asc(intentions.createdAt)],
      });
    }),

  createUtterance: protectedProcedure
    .input(z.object({ content: z.string().min(1), beingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // This procedure remains the same
      const userRecord = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
      });
      if (!userRecord?.beingId) throw new Error("User does not have an associated Being.");

      const userIntentionId = `/utterance-${crypto.randomUUID()}`;
      await ctx.db.insert(intentions).values({
        id: userIntentionId,
        name: `Utterance by ${ctx.session.user.name ?? "user"}`,
        type: "utterance",
        state: "complete",
        ownerId: userRecord.beingId,
        locationId: input.beingId,
        content: [input.content],
      });

      const aiIntentionId = `/utterance-ai-${crypto.randomUUID()}`;
      await ctx.db.insert(intentions).values({
        id: aiIntentionId,
        name: "AI Response",
        type: "utterance",
        state: "active",
        ownerId: AI_AGENT_BEING_ID,
        locationId: input.beingId,
        content: [""],
      });

      // We don't await this, it runs in the background
      streamAiResponse({
        db: ctx.db,
        userContent: input.content,
        beingId: input.beingId,
        aiIntentionId,
      }).catch(console.error);

      return { success: true, aiIntentionId };
    }),

  
});