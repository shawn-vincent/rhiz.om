/**
 * React sync hook with real-time being and intention updates
 *
 * Returns both beings and intentions with delta sync for efficiency.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type SyncEvent,
	connect,
	disconnect,
	isConnected,
	subscribe,
} from "~/lib/stream";
import type { Being, Intention } from "~/server/db/types";

// Sync hook returns both beings and intentions
export function useSync(spaceId: string) {
	const [intentions, setIntentions] = useState<Intention[]>([]);
	const [beings, setBeings] = useState<Being[]>([]);
	const [connected, setConnected] = useState(false);
	const connectionId = useRef<string | null>(null);
	const checkInterval = useRef<number | null>(null);

	// Apply delta to both intentions and beings
	const applyDelta = useCallback((delta: SyncEvent) => {
		// Update intentions
		setIntentions((current) => {
			const intentionMap = new Map(current.map((i) => [i.id, i]));

			// Apply deletions
			for (const deletedId of delta.intentions.deleted) {
				intentionMap.delete(deletedId);
			}

			// Apply created intentions
			for (const intention of delta.intentions.created) {
				intentionMap.set(intention.id, intention);
			}

			// Apply updated intentions
			for (const intention of delta.intentions.updated) {
				intentionMap.set(intention.id, intention);
			}

			// Convert back to sorted array
			return Array.from(intentionMap.values()).sort(
				(a, b) =>
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
			);
		});

		// Update beings
		setBeings((current) => {
			const beingMap = new Map(current.map((b) => [b.id, b]));

			// Apply deletions
			for (const deletedId of delta.beings.deleted) {
				beingMap.delete(deletedId);
			}

			// Apply created beings
			for (const being of delta.beings.created) {
				beingMap.set(being.id, being);
			}

			// Apply updated beings  
			for (const being of delta.beings.updated) {
				beingMap.set(being.id, being);
			}

			// Convert back to sorted array
			return Array.from(beingMap.values()).sort(
				(a, b) => a.name.localeCompare(b.name),
			);
		});
	}, []);

	useEffect(() => {
		// Connect
		connectionId.current = connect(spaceId);

		// Subscribe to space-delta events
		const unsubscribe = subscribe(connectionId.current, (event: SyncEvent) => {
			if (event.type === "space-delta") {
				applyDelta(event);
			}
		});

		// Check connection status periodically
		checkInterval.current = window.setInterval(() => {
			if (connectionId.current) {
				setConnected(isConnected(connectionId.current));
			}
		}, 1000);

		return () => {
			unsubscribe();
			if (connectionId.current) {
				disconnect(connectionId.current);
			}
			if (checkInterval.current) {
				clearInterval(checkInterval.current);
			}
		};
	}, [spaceId, applyDelta]);

	// Return both beings and intentions for real-time updates
	return { beings, intentions, isConnected: connected };
}
