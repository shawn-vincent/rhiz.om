import { Suspense } from "react";
import { DevModeAuth } from "~/components/dev-mode-auth";

interface SignInPageProps {
	searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
	const { callbackUrl, error } = await searchParams;
	const isDevelopment = process.env.NODE_ENV === "development";

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-black p-4">
			<div className="w-full max-w-md space-y-6">
				<div className="text-center">
					<h1 className="font-bold text-3xl text-white">Welcome to Rhiz.om</h1>
					<p className="mt-2 text-gray-400">Sign in to join the conversation</p>
				</div>

				{error && (
					<div className="rounded-md border border-red-500/20 bg-red-500/10 p-4">
						<p className="text-red-400 text-sm">
							Authentication error: {error}
						</p>
					</div>
				)}

				<Suspense
					fallback={<div className="text-center text-white">Loading...</div>}
				>
					<DevModeAuth
						callbackUrl={callbackUrl}
						isDevelopment={isDevelopment}
					/>
				</Suspense>
			</div>
		</div>
	);
}
