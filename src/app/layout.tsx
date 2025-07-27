import "~/styles/globals.css";

import type { Metadata } from "next";
import { Recursive } from "next/font/google";

import { AppShell } from "~/app/_components/app-shell";
import { NextAuthSessionProvider } from "~/app/_components/session-provider";
import { Toaster } from "~/components/ui/sonner";
import { TRPCReactProvider } from "~/trpc/react";

export const viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
};

export const metadata: Metadata = {
	title: "Rhiz.om",
	description: "A place to pause, notice, and connect.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
	manifest: "/manifest.json",
};

const recursive = Recursive({
	subsets: ["latin"],
	variable: "--font-recursive",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html
			lang="en"
			className={`${recursive.variable} dark`}
			suppressHydrationWarning={true}
		>
			<body className="fixed inset-0 h-full w-full touch-none overflow-hidden overscroll-none bg-background">
				<NextAuthSessionProvider>
					<TRPCReactProvider>
						<AppShell>{children}</AppShell>
					</TRPCReactProvider>
				</NextAuthSessionProvider>
				<Toaster position="top-center" />
			</body>
		</html>
	);
}
