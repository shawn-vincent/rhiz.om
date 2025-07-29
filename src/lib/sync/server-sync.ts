import { broadcastSyncEvent } from "~/server/lib/livekit";
import type { SyncEvent, SyncServer } from "../sync";

export class ServerSync implements SyncServer {
	async broadcast(event: SyncEvent): Promise<void> {
		await broadcastSyncEvent(event.locationId, event);
	}
}