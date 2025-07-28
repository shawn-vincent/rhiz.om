"use client";

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchStreamLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import superjson from "superjson";

import type { AppRouter } from "~/server/api/root";
import { createQueryClient } from "./query-client";
let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
	if (typeof window === "undefined") {
		return createQueryClient();
	}
	clientQueryClientSingleton ??= createQueryClient();
	return clientQueryClientSingleton;
};

export const api = createTRPCReact<AppRouter>();

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
	const queryClient = getQueryClient();

	const [trpcClient] = useState(() =>
		api.createClient({
			links: [
				loggerLink({
					enabled: (op) =>
						process.env.NODE_ENV === "development" &&
						((op.direction === "down" && op.result instanceof Error) || 
						 op.path?.includes("being.getAll")),
					logger: (opts) => {
						// Temporary: Debug being.getAll calls with undefined
						if (opts.path?.includes("being.getAll")) {
							console.log(`🔍 being.getAll DEBUG:`, {
								path: opts.path,
								direction: opts.direction,
								input: opts.input,
								inputString: JSON.stringify(opts.input),
								hasUndefined: JSON.stringify(opts.input).includes("undefined"),
								result: opts.result instanceof Error ? "ERROR" : "SUCCESS"
							});
						}
						
						// Only log errors
						if (opts.direction === "down" && opts.result instanceof Error) {
							const error = opts.result as any;
							console.group(`🚨 tRPC Error: ${opts.path}`);
							console.error("Error Details:", {
								message: error.message,
								code: error.code,
								httpStatus: error.data?.httpStatus,
								zodError: error.data?.zodError,
								stack: error.data?.stack || error.stack,
								cause: error.cause,
							});
							console.error("Request Details:", {
								path: opts.path,
								input: opts.input,
								type: opts.type,
								elapsedMs: opts.elapsedMs,
							});
							if (error.data?.zodError) {
								console.error("Validation Errors:", error.data.zodError);
							}
							console.groupEnd();
						}
					},
				}),
				httpBatchStreamLink({
					transformer: superjson,
					url: `${getBaseUrl()}/api/trpc`,
					headers: () => {
						const headers = new Headers();
						headers.set("x-trpc-source", "nextjs-react");
						return headers;
					},
					fetch: async (url, init) => {
						console.log(`🌐 FETCH ATTEMPT: ${init?.method || 'GET'} ${url}`);
						try {
							const response = await fetch(url, init as RequestInit);
							console.log(`🌐 FETCH RESPONSE: ${response.status} ${response.statusText}`);
							
							// Fix: Ensure response stream is properly cloned to prevent consumption issues
							// This prevents race conditions where multiple parts of tRPC try to read the same stream
							if (response.ok) {
								// Clone the response to create independent readable streams
								const responseClone = response.clone();
								// Immediately consume and discard the clone to stabilize the original stream
								responseClone.text().catch(() => {}); // Ignore errors, this is just for stream stability
							}
							
							// Log HTTP errors (4xx, 5xx) but don't throw
							if (!response.ok) {
								let responseText = '';
								try {
									responseText = await response.clone().text();
								} catch (e) {
									responseText = 'Could not read response body';
								}
								
								console.group(`🌐 HTTP ${response.status} Error: ${init?.method || 'GET'} ${url}`);
								console.error("Response Details:", {
									status: response.status,
									statusText: response.statusText,
									headers: Object.fromEntries(response.headers.entries()),
									body: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''),
								});
								console.error("Request Details:", {
									method: init?.method || 'GET',
									headers: init?.headers,
								});
								console.groupEnd();
							}
							
							return response;
						} catch (fetchError) {
							console.group(`🌐 FETCH EXCEPTION: ${init?.method || 'GET'} ${url}`);
							console.error("Network failure:", {
								name: (fetchError as Error).name,
								message: (fetchError as Error).message,
								stack: (fetchError as Error).stack,
							});
							console.error("Possible causes:", [
								"Server not running",
								"Network disconnected", 
								"CORS issue",
								"Request blocked"
							]);
							console.groupEnd();
							throw fetchError;
						}
					},
				}),
			],
		}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			<api.Provider client={trpcClient} queryClient={queryClient}>
				<main className="font-sans">{props.children}</main>
			</api.Provider>
		</QueryClientProvider>
	);
}

function getBaseUrl() {
	if (typeof window !== "undefined") return window.location.origin;
	if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
	return `http://localhost:${process.env.PORT ?? 3000}`;
}
