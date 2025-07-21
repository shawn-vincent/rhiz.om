export default function DemoLayout({
	children,
}: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center py-2">
			<main className="flex w-full flex-1 flex-col items-center justify-center px-20 text-center">
				{children}
			</main>
		</div>
	);
}
