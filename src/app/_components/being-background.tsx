// src/app/_components/being-background.tsx
import React from "react";
import ErrorBoundary from "~/components/ui/error-boundary";

export function BeingBackground() {
	return (
		<ErrorBoundary>
			<div
				className="absolute inset-0 z-0 bg-center bg-cover"
				style={{
					backgroundImage: `url('https://upload.wikimedia.org/wikipedia/commons/1/14/Rockies_in_the_morning.jpg')`,
				}}
			/>
		</ErrorBoundary>
	);
}
