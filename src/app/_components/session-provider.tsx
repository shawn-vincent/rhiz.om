"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

interface Props {
	children: React.ReactNode;
	session?: Session | null;
}

export function NextAuthSessionProvider({ children, session }: Props) {
	return <SessionProvider session={session}>{children}</SessionProvider>;
}
