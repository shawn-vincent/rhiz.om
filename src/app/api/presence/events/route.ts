import { eq } from "drizzle-orm";
// src/app/api/presence/events/route.ts
import type { NextRequest } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { beings } from "~/server/db/schema";
import type { BeingId } from "~/server/db/types";
import {
	type ConnectionInfo,
	beingConnections,
	broadcastPresenceUpdate,
	connections,
} from "~/server/lib/presence";
import { triggerPresenceUpdate } from "~/server/lib/state-sync";

// Heartbeat configuration
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const CONNECTION_TIMEOUT = 60000; // 60 seconds

// Cleanup interval for stale connections
setInterval(() => {
	const now = Date.now();
	const staleConnections: string[] = [];

	for (const [connectionId, info] of connections) {
		if (now - info.lastHeartbeat > CONNECTION_TIMEOUT) {
			staleConnections.push(connectionId);
		}
	}

	for (const connectionId of staleConnections) {
		cleanupConnection(connectionId, true);
	}
}, HEARTBEAT_INTERVAL);

function cleanupConnection(connectionId: string, broadcast = false) {
	const connection = connections.get(connectionId);
	if (!connection) return;

	const { beingId } = connection;

	// Remove from connections
	connections.delete(connectionId);

	// Remove from being index
	const beingConns = beingConnections.get(beingId);
	if (beingConns) {
		beingConns.delete(connectionId);
		if (beingConns.size === 0) {
			beingConnections.delete(beingId);
			// Being is now offline, broadcast if needed
			if (broadcast) {
				broadcastPresenceUpdate({
					type: "presence_change",
					beingId,
					isOnline: false,
				});

				// Also trigger new state sync system - find which spaces this being is in
				db.select()
					.from(beings)
					.where(eq(beings.id, beingId))
					.limit(1)
					.then((being) => {
						if (being[0]?.locationId) {
							triggerPresenceUpdate(being[0].locationId as BeingId, {
								type: "update",
								entityId: beingId,
								causedBy: beingId as BeingId,
							});
						}
					})
					.catch(console.error);
			}
		}
	}

	// Close the connection
	try {
		connection.controller.close();
	} catch (error) {
		// Connection might already be closed
	}
}

export async function GET(request: NextRequest) {
	const session = await getServerAuthSession();

	if (!session?.user?.beingId) {
		return new Response("Unauthorized", { status: 401 });
	}

	const beingId = session.user.beingId;
	const connectionId = crypto.randomUUID();
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		start(controller) {
			const now = Date.now();
			const connectionInfo: ConnectionInfo = {
				controller,
				beingId,
				connectedAt: now,
				lastHeartbeat: now,
			};

			// Store connection
			connections.set(connectionId, connectionInfo);

			// Update being index
			if (!beingConnections.has(beingId)) {
				beingConnections.set(beingId, new Set());
				// Being came online, broadcast to old system
				broadcastPresenceUpdate({
					type: "presence_change",
					beingId,
					isOnline: true,
				});

				// Also trigger new state sync system - find which spaces this being is in
				db.select()
					.from(beings)
					.where(eq(beings.id, beingId))
					.limit(1)
					.then((being) => {
						if (being[0]?.locationId) {
							triggerPresenceUpdate(being[0].locationId as BeingId, {
								type: "update",
								entityId: beingId,
								causedBy: beingId as BeingId,
							});
						}
					})
					.catch(console.error);
			}
			beingConnections.get(beingId)!.add(connectionId);

			// Send initial connection message
			controller.enqueue(
				encoder.encode(
					`data: ${JSON.stringify({
						type: "connected",
						connectionId,
						heartbeatInterval: HEARTBEAT_INTERVAL,
					})}\n\n`,
				),
			);

			// Set up heartbeat
			const heartbeatInterval = setInterval(() => {
				try {
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`,
						),
					);
				} catch (error) {
					clearInterval(heartbeatInterval);
					cleanupConnection(connectionId, true);
				}
			}, HEARTBEAT_INTERVAL);

			// Store interval for cleanup
			connectionInfo.controller = controller;
		},
		cancel() {
			cleanupConnection(connectionId, true);
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no", // Disable Nginx buffering
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
			"Access-Control-Allow-Credentials": "true",
		},
	});
}

// Handle heartbeat responses from client
export async function POST(request: NextRequest) {
	const session = await getServerAuthSession();
	if (!session?.user?.beingId) {
		return new Response("Unauthorized", { status: 401 });
	}

	const { connectionId } = await request.json();
	const connection = connections.get(connectionId);

	if (connection && connection.beingId === session.user.beingId) {
		connection.lastHeartbeat = Date.now();
		return new Response(JSON.stringify({ success: true }));
	}

	return new Response("Connection not found", { status: 404 });
}
