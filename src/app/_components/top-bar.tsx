// src/app/_components/top-bar.tsx
"use client";

import type { Session } from "next-auth";
import ErrorBoundary from "~/components/ui/error-boundary";

export function TopBar({ session }: { session: Session | null }) {
	// TopBar is now minimal - all controls moved to BottomBar
	return null;
}
