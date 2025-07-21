import { useEffect, useState } from "react";

export function useRecents<T>(key: string, max: number) {
	const storageKey = `rhizom.recents.${key}`;
	const [recents, setRecents] = useState<T[]>(() => {
		if (typeof window === "undefined") return [];
		try {
			const item = window.localStorage.getItem(storageKey);
			return item ? JSON.parse(item) : [];
		} catch (error) {
			console.error("Failed to read recents from localStorage", error);
			return [];
		}
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			window.localStorage.setItem(storageKey, JSON.stringify(recents));
		} catch (error) {
			console.error("Failed to write recents to localStorage", error);
		}
	}, [recents, storageKey]);

	const addRecent = (item: T) => {
		setRecents((prevRecents) => {
			const newRecents = [item, ...prevRecents.filter((r) => r !== item)];
			return newRecents.slice(0, max);
		});
	};

	return { recents, addRecent };
}
