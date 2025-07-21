// src/app/_components/app-shell.tsx
import ErrorBoundary from "~/components/ui/error-boundary";

export async function AppShell({ children }: { children: React.ReactNode }) {
	return (
		<ErrorBoundary>
			<main className="h-dvh w-full overflow-y-auto bg-black text-white">
				{children}
			</main>
		</ErrorBoundary>
	);
}
