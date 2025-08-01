import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

import { env } from "~/env";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import { logger } from "~/server/lib/logger";

export const runtime = "nodejs"; // Required for LiveKit server SDK

const trpcLogger = logger.child({ name: "tRPC" });

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
const createContext = async (req: NextRequest) => {
	return createTRPCContext({
		headers: req.headers,
	});
};

const handler = (req: NextRequest) =>
	fetchRequestHandler({
		endpoint: "/api/trpc",
		req,
		router: appRouter,
		createContext: () => createContext(req),
		onError:
			env.NODE_ENV === "development"
				? ({ path, error }) => {
						trpcLogger.error(error, `tRPC failed on ${path ?? "<no-path>"}`);
					}
				: undefined,
	});

export { handler as GET, handler as POST };
