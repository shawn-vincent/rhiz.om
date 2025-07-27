import { useCallback, useEffect, useState } from "react";
import superjson from "superjson";

/**
 * Hook for managing recent items in localStorage
 */
export function useRecents<T extends { id: string }>(
	key: string,
	maxItems = 10,
) {
	const [recents, setRecents] = useState<T[]>([]);

	// Load recents from localStorage on mount
	useEffect(() => {
		if (typeof window === "undefined") return;

		try {
			const stored = localStorage.getItem(`recents-${key}`);
			if (stored) {
				const parsed = superjson.parse(stored) as T[];
				setRecents(parsed);
			}
		} catch (error) {
			console.warn(`Failed to load recents for ${key}:`, error);
		}
	}, [key]);

	// Add an item to recents
	const addRecent = useCallback(
		(item: T) => {
			setRecents((prev) => {
				// Remove if already exists
				const filtered = prev.filter((r) => r.id !== item.id);
				// Add to front and limit
				const newRecents = [item, ...filtered].slice(0, maxItems);

				// Save to localStorage
				if (typeof window !== "undefined") {
					try {
						localStorage.setItem(
							`recents-${key}`,
							superjson.stringify(newRecents),
						);
					} catch (error) {
						console.warn(`Failed to save recents for ${key}:`, error);
					}
				}

				return newRecents;
			});
		},
		[key, maxItems],
	);

	// Clear all recents
	const clearRecents = useCallback(() => {
		setRecents([]);
		if (typeof window !== "undefined") {
			try {
				localStorage.removeItem(`recents-${key}`);
			} catch (error) {
				console.warn(`Failed to clear recents for ${key}:`, error);
			}
		}
	}, [key]);

	return {
		recents,
		addRecent,
		clearRecents,
	};
}
