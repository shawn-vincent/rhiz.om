/**
 * Simple React sync hooks
 *
 * Direct state management. No complex state machines.
 */
import { useEffect, useRef, useState } from "react";
import {
	type SyncEvent,
	connect,
	disconnect,
	isConnected,
	subscribe,
} from "~/lib/stream";
import type { Being, Intention } from "~/server/db/types";

// Single unified sync hook
export function useSync(spaceId?: string, types?: string[]) {
	const [beings, setBeings] = useState<Being[]>([]);
	const [intentions, setIntentions] = useState<Intention[]>([]);
	const [connected, setConnected] = useState(false);
	const connectionId = useRef<string | null>(null);
	const checkInterval = useRef<number | null>(null);

	useEffect(() => {
		// Connect
		connectionId.current = connect(spaceId, types);

		// Subscribe to all events
		const unsubscribe = subscribe(connectionId.current, (event: SyncEvent) => {
			switch (event.type) {
				case "beings":
					setBeings(event.data);
					break;
				case "intentions":
					setIntentions(event.data);
					break;
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
	}, [spaceId, types]);

	return { beings, intentions, isConnected: connected };
}
