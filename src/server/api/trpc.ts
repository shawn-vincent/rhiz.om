/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod/v4";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { services } from "~/domain/services";
import { logger } from "~/server/lib/logger";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
	const session = await auth();

	return {
		db,
		session,
		...opts,
	};
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zodError:
					error.cause instanceof ZodError ? error.cause.flatten() : null,
			},
		};
	},
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const loggingMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
	const start = Date.now();
	const result = await next();
	const durationMs = Date.now() - start;

	const meta = {
		path,
		type,
		durationMs,
		userId: ctx.session?.user?.id,
		ok: result.ok,
	};

	if (result.ok) {
		logger.info(meta, "tRPC OK");
	} else {
		logger.error(result.error, "tRPC Error");
	}

	return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(loggingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
/**
 * Protected procedure that requires basic authentication
 * Use this when you only need to ensure user is logged in
 */
export const protectedProcedure = t.procedure
	.use(loggingMiddleware)
	.use(async ({ ctx, next }) => {
		const session = services.auth.validateBasicSession(ctx.session);
		return next({
			ctx: {
				...ctx,
				session,
			},
		});
	});

/**
 * Authorized procedure with full auth context including being data
 * Use this when you need permissions or access to current user's being
 */
export const authorizedProcedure = t.procedure
	.use(loggingMiddleware)
	.use(async ({ ctx, next }) => {
		const auth = await services.auth.validateSession(ctx.session);
		return next({
			ctx: {
				...ctx,
				session: ctx.session!, // We know it's valid from validateSession
				auth,
			},
		});
	});
