import "~/styles/globals.css";

import type { Metadata } from "next";
import { Recursive } from "next/font/google";

import { AppShell } from "~/app/_components/app-shell";
import { TRPCReactProvider } from "~/trpc/react";
import { Toaster } from "~/components/ui/sonner";

export const metadata: Metadata = {
	viewport: {
		width: "device-width",
		initialScale: 1,
		maximumScale: 1,
	},
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
		<html lang="en" className={`${recursive.variable} dark`}>
			<body className="fixed inset-0 h-full w-full touch-none overflow-hidden overscroll-none bg-background">
				<TRPCReactProvider>
					<AppShell>{children}</AppShell>
				</TRPCReactProvider>
				<Toaster position="top-center" />
			</body>
		</html>
	);
}
