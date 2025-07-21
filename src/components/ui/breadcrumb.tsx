// src/components/ui/breadcrumb.tsx
"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { cn } from "~/lib/utils";

export interface BreadcrumbItem {
	label: string;
	href?: string;
	current?: boolean;
}

interface BreadcrumbProps {
	items: BreadcrumbItem[];
	className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
	return (
		<nav
			aria-label="Breadcrumb"
			className={cn("flex items-center space-x-1 text-sm", className)}
		>
			<ol className="flex items-center space-x-1 overflow-hidden">
				{items.map((item, index) => (
					<Fragment key={index}>
						<li className="flex items-center">
							{item.href && !item.current ? (
								<Link
									href={item.href}
									className="truncate text-muted-foreground transition-colors hover:text-foreground"
								>
									{item.label}
								</Link>
							) : (
								<span
									className={cn(
										"truncate",
										item.current
											? "font-medium text-foreground"
											: "text-muted-foreground",
									)}
								>
									{item.label}
								</span>
							)}
						</li>
						{index < items.length - 1 && (
							<li className="flex items-center">
								<ChevronRight className="size-3 shrink-0 text-muted-foreground" />
							</li>
						)}
					</Fragment>
				))}
			</ol>
		</nav>
	);
}

// Mobile-optimized version with back button and condensed display
interface MobileBreadcrumbProps {
	items: BreadcrumbItem[];
	onBack?: () => void;
	className?: string;
}

export function MobileBreadcrumb({
	items,
	onBack,
	className,
}: MobileBreadcrumbProps) {
	const currentItem = items[items.length - 1];
	const parentItem = items[items.length - 2];

	return (
		<nav
			aria-label="Breadcrumb"
			className={cn("flex flex-col overflow-hidden", className)}
		>
			{/* Current page title */}
			<h1 className="truncate font-semibold text-base text-foreground">
				{currentItem?.label}
			</h1>

			{/* Breadcrumb trail - shows parent > current on mobile */}
			{parentItem && (
				<div className="flex items-center truncate text-muted-foreground text-sm">
					{parentItem.href ? (
						<Link
							href={parentItem.href}
							className="truncate transition-colors hover:text-foreground"
						>
							{parentItem.label}
						</Link>
					) : (
						<span className="truncate">{parentItem.label}</span>
					)}
					<ChevronRight className="mx-1 size-3 shrink-0" />
					<span className="truncate">{currentItem?.label}</span>
				</div>
			)}
		</nav>
	);
}
