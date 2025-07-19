// src/server/api/routers/being.ts
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { beings } from "~/server/db/schema";
import { insertBeingSchema, selectBeingSchema } from "~/server/db/types";
import { TRPCError } from "@trpc/server";

export const beingRouter = createTRPCRouter({
  /**
   * Fetches a single being by its public ID.
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .output(selectBeingSchema)
    .query(async ({ ctx, input }) => {
      const being = await ctx.db.query.beings.findFirst({
        where: eq(beings.id, input.id),
      });
      if (!being) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Being with ID "${input.id}" not found.`,
        });
      }
      return selectBeingSchema.parse(being);
    }),

  /**
   * Creates or updates a being.
   * This is a protected procedure, requiring the user to be authenticated.
   * It also verifies that the user is the owner of the being they are trying to modify.
   */
  upsert: protectedProcedure
    .input(insertBeingSchema)
    .mutation(async ({ ctx, input }) => {
      const sessionBeingId = ctx.session.user.beingId;

      // Authorization: Ensure user is trying to save a being they own.
      if (!input.ownerId || input.ownerId !== sessionBeingId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only save beings that you own.",
        });
      }

      // Use Drizzle's ON CONFLICT for an atomic upsert operation.
      // This is the best practice for create-or-update logic.
      return ctx.db
        .insert(beings)
        .values({
          ...input,
          modifiedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: beings.id,
          set: {
            ...input,
            modifiedAt: new Date(),
          },
        });
    }),

  /**
   * Fetches all beings, ordered by name.
   */
  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.db.query.beings.findMany({
      orderBy: (beings, { asc }) => [asc(beings.name)],
    });
  }),
});
