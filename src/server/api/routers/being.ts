// src/server/api/routers/being.ts
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const beingRouter = createTRPCRouter({
  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.db.query.beings.findMany({
      orderBy: (beings, { asc }) => [asc(beings.name)],
    });
  }),
});