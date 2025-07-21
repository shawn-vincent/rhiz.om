// src/app/select/being/page.tsx
"use client";

import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect } from "react";

import { EntityCard } from "packages/entity-kit/src/components/ui/EntityCard";
import { EntitySkeleton } from "packages/entity-kit/src/components/ui/EntitySkeleton";
import { Button } from "~/components/ui/button";
import ErrorBoundary from "~/components/ui/error-boundary";
import { Input } from "~/components/ui/input";
import { useBeings } from "~/hooks/use-beings";

export default function BeingSelectPage() {
	const router = useRouter();
	const searchParams = useSearchParams();

	// Get callback info from URL params
	const returnUrl = searchParams.get("returnUrl") || "/";
	const fieldName = searchParams.get("field") || "beingId";
	const currentValue = searchParams.get("value") || "";

	const [searchQuery, setSearchQuery] = useState("");
	const { items: beings, isLoading, isError } = useBeings();

	// Filter beings based on search query
	const filteredBeings = beings.filter(
		(being) =>
			being.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			being.id.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	// Recent selections - stored in localStorage
	const [recentSelections, setRecentSelections] = useState<string[]>([]);

	useEffect(() => {
		const stored = localStorage.getItem("recent-being-selections");
		if (stored) {
			try {
				setRecentSelections(JSON.parse(stored));
			} catch {
				// Ignore parsing errors
			}
		}
	}, []);

	const addToRecent = (beingId: string) => {
		const updated = [
			beingId,
			...recentSelections.filter((id) => id !== beingId),
		].slice(0, 5);
		setRecentSelections(updated);
		localStorage.setItem("recent-being-selections", JSON.stringify(updated));
	};

	const handleSelect = (beingId: string) => {
		addToRecent(beingId);

		// Use postMessage to communicate with parent window/form
		if (window.opener) {
			window.opener.postMessage(
				{
					type: "BEING_SELECTED",
					field: fieldName,
					value: beingId,
				},
				"*",
			);
			window.close();
		} else {
			// Fallback: redirect back with selected value
			const url = new URL(returnUrl, window.location.origin);
			url.searchParams.set(fieldName, beingId);
			router.push(url.toString());
		}
	};

	const recentBeings = recentSelections
		.map((id) => beings.find((b) => b.id === id))
		.filter((being): being is NonNullable<typeof being> => Boolean(being));

	return (
		<ErrorBoundary>
			<div className="min-h-screen bg-background">
				{/* Mobile-optimized header */}
				<header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
					<div className="flex h-mobile-touch items-center gap-mobile-gap px-mobile-margin">
						<Button
							variant="ghost"
							size="sm"
							className="shrink-0 p-2"
							onClick={() => {
								if (window.opener) {
									window.close();
								} else {
									router.push(returnUrl);
								}
							}}
							aria-label="Cancel selection"
						>
							<ArrowLeft className="size-4" />
						</Button>
						<h1 className="font-semibold text-base text-foreground">
							Select Being
						</h1>
					</div>
				</header>

				{/* Search-first interface */}
				<div className="container space-y-4 px-mobile-margin py-4">
					{/* Search input */}
					<div className="relative">
						<Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
						<Input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search beings..."
							className="h-mobile-touch pl-9"
							autoFocus
						/>
					</div>

					{/* Recent selections */}
					{!searchQuery && recentBeings.length > 0 && (
						<div className="space-y-2">
							<h2 className="font-medium text-foreground text-sm">
								Recent selections
							</h2>
							<div className="space-y-2">
								{recentBeings.map((being) => (
									<button
										key={being.id}
										onClick={() => handleSelect(being.id)}
										className="w-full rounded-md border p-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
									>
										<EntityCard
											entity={{
												id: being.id,
												name: being.name,
												type: being.type as any,
											}}
											variant="compact"
										/>
									</button>
								))}
							</div>
						</div>
					)}

					{/* Search results or all beings */}
					<div className="space-y-2">
						{!searchQuery && recentBeings.length > 0 && (
							<h2 className="font-medium text-foreground text-sm">
								All beings
							</h2>
						)}

						{isLoading ? (
							<div className="space-y-2">
								<EntitySkeleton />
								<EntitySkeleton />
								<EntitySkeleton />
							</div>
						) : isError ? (
							<div className="py-8 text-center text-muted-foreground">
								Error loading beings
							</div>
						) : filteredBeings.length === 0 ? (
							<div className="py-8 text-center text-muted-foreground">
								No beings found
							</div>
						) : (
							<div className="space-y-2">
								{filteredBeings.map((being) => (
									<button
										key={being.id}
										onClick={() => handleSelect(being.id)}
										className={`w-full rounded-md border p-2 text-left transition-colors ${
											being.id === currentValue
												? "border-accent-foreground/20 bg-accent text-accent-foreground"
												: "hover:bg-accent hover:text-accent-foreground"
										}`}
									>
										<EntityCard
											entity={{
												id: being.id,
												name: being.name,
												type: being.type as any,
											}}
											variant="compact"
										/>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</ErrorBoundary>
	);
}
