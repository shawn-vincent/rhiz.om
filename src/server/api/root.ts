import { intentionRouter } from "~/server/api/routers/intention";
import { beingRouter } from "~/server/api/routers/being"; // 1. Import router
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  intention: intentionRouter,
  being: beingRouter, // 2. Add router
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @.env.example
 * const trpc = createCaller(createContext);
 * const res = await trpc.intention.getAllUtterancesInBeing({ beingId: " @some-being" });
 */
export const createCaller = createCallerFactory(appRouter);