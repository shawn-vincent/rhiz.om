import { cn } from "~/lib/utils";

interface EntitySkeletonProps {
	lines?: 1 | 2;
}

export function EntitySkeleton({ lines = 2 }: EntitySkeletonProps) {
	return (
		<div
			className={cn(
				"relative flex animate-pulse items-center gap-mobile-gap rounded-md p-2",
				lines === 1 ? "h-mobile-touch" : "h-14",
			)}
		>
			<div className="size-10 shrink-0 rounded-full bg-muted" />
			<div className="flex flex-col gap-1.5 overflow-hidden">
				<div className="h-4 w-32 xs:w-24 rounded bg-muted" />
				{lines === 2 && <div className="h-3 w-24 xs:w-20 rounded bg-muted" />}
			</div>
		</div>
	);
}
