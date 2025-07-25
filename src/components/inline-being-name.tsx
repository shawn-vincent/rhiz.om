// src/components/inline-being-name.tsx
"use client";

import { InlineBeingNameSimple } from "./inline-being-name-simple";

interface InlineBeingNameProps {
	fallback?: string;
	className?: string;
	readOnly?: boolean;
}

export function InlineBeingName({
	fallback = "Rhiz.om",
	className,
	readOnly = false,
}: InlineBeingNameProps) {
	// Only use the simple system now
	return (
		<InlineBeingNameSimple
			fallback={fallback}
			className={className}
			readOnly={readOnly}
		/>
	);
}