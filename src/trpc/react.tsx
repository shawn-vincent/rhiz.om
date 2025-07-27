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
						process.env.NODE_ENV === "development" ||
						(op.direction === "down" && op.result instanceof Error),
					logger: (opts) => {
						if (opts.direction === "down" && opts.result instanceof Error) {
							console.error("tRPC Error:", {
								path: opts.path,
								error: opts.result,
								input: opts.input,
							});
						}
						// Debug SuperJSON transformation
						if (
							opts.direction === "down" &&
							opts.path?.includes("being.getById")
						) {
							console.log("🐛 tRPC SuperJSON debug:", {
								path: opts.path,
								result: opts.result,
								type: typeof (opts.result as any)?.data?.createdAt,
								isDate: (opts.result as any)?.data?.createdAt instanceof Date,
								raw: (opts.result as any)?.data?.createdAt,
							});
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
