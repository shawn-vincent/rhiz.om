import "~/styles/globals.css";

import type { Metadata } from "next";
import { Recursive } from "next/font/google";

import { AppShell } from "~/app/_components/app-shell";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Rhiz.om",
  description: "A place to pause, notice, and connect.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
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
      <body>
        <TRPCReactProvider>
          <AppShell>{children}</AppShell>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
