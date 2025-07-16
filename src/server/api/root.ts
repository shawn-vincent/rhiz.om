import { intentionRouter } from "~/server/api/routers/intention";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  intention: intentionRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @.env.example
 * const trpc = createCaller(createContext);
 * const res = await trpc.intention.getAllUtterancesInSpace({ spaceId: " @some-space" });
 */
export const createCaller = createCallerFactory(appRouter);