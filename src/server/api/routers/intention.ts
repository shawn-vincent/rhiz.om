import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { intentions, users } from "~/server/db/schema";
import { ContentNode } from "~/server/db/content-types";

export const intentionRouter = createTRPCRouter({
  // A public procedure to get all utterances in a space (location)
  getAllUtterancesInSpace: publicProcedure
    .input(z.object({ spaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.intentions.findMany({
        where: eq(intentions.locationId, input.spaceId),
        orderBy: (intentions, { asc }) => [asc(intentions.createdAt)],
      });
    }),

  // A protected procedure to create a new utterance (chat message)
  createUtterance: protectedProcedure
    .input(z.object({ content: z.string().min(1), spaceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // In a real app, we'd create a Being for the user on first login.
      // For now, we'll fetch it, assuming it exists.
      const userRecord = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.session.user.id),
      });

      if (!userRecord?.beingId) {
        throw new Error("User does not have an associated Being.");
      }

      const newIntentionId = `/utterance-${crypto.randomUUID()}`;

      let content: ContentNode[];
      if (input.content === "/error") {
        content = [
          "This is **important**.",
          {
            type: "error",
            content: ["An error occurred: ```json\n{\n  \"code\": 500,\n  \"message\": \"Internal Server Error\"\n}\n```"],
          },
          "Please try again.",
        ];
      } else {
        content = [input.content];
      }

      await ctx.db.insert(intentions).values({
        id: newIntentionId,
        name: `Utterance by ${ctx.session.user.name ?? "user"}`,
        type: "utterance",
        state: "complete",
        ownerId: userRecord.beingId,
        locationId: input.spaceId,
        content: content as any, // Drizzle types jsonb as unknown, so we cast
        modifiedAt: new Date(),
        createdAt: new Date(),
      });
    }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});