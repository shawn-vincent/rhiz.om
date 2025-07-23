// Helper functions for presence management
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { beings } from "~/server/db/schema";

// Store active connections by connection ID
export const connections = new Map<string, ConnectionInfo>();
// Index by beingId for quick lookup
export const beingConnections = new Map<string, Set<string>>();

export interface ConnectionInfo {
	controller: ReadableStreamDefaultController;
	beingId: string;
	connectedAt: number;
	lastHeartbeat: number;
}

// Helper function to broadcast presence events to all connected clients
export function broadcastPresenceUpdate(eventData: {
	type: "presence_change" | "location_change";
	beingId: string;
	isOnline?: boolean;
	locationId?: string | null;
}) {
	const encoder = new TextEncoder();
	const data = `data: ${JSON.stringify(eventData)}\n\n`;
	const encodedData = encoder.encode(data);

	// Send to all connected clients
	for (const connection of connections.values()) {
		try {
			connection.controller.enqueue(encodedData);
		} catch (error) {
			// Connection might be closed, will be cleaned up by heartbeat
		}
	}
}

// Helper to get current online beings by connection status
export async function getCurrentPresence() {
	const allBeings = await db
		.select({
			id: beings.id,
			name: beings.name,
			type: beings.type,
			locationId: beings.locationId,
		})
		.from(beings);

	return allBeings.map((being) => ({
		...being,
		isOnline:
			being.type === "space" ||
			being.type === "bot" ||
			beingConnections.has(being.id),
	}));
}

// Helper to check if a specific being is online
export function isBeingOnline(beingId: string, beingType: string): boolean {
	if (beingType === "space" || beingType === "bot") {
		return true;
	}
	return beingConnections.has(beingId);
}