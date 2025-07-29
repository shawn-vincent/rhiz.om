import { type RemoteParticipant, Room, RoomEvent } from "livekit-client";
import type { SyncClient, SyncEvent } from "../sync";

export class LiveKitSync implements SyncClient {
	private _room: Room | null = null;
	private currentLocationId: string | null = null;
	private subscribers = new Set<(event: SyncEvent) => void>();
	private getTokenFn: ((roomBeingId: string) => Promise<{ token: string; wsUrl: string }>) | null = null;

	setTokenFunction(fn: (roomBeingId: string) => Promise<{ token: string; wsUrl: string }>) {
		this.getTokenFn = fn;
	}

	get isConnected(): boolean {
		return this._room?.state === "connected";
	}

	get room(): Room | null {
		return this._room;
	}

	async connect(locationId: string): Promise<void> {
		if (this.currentLocationId === locationId && this.isConnected) {
			return;
		}

		if (!this.getTokenFn) {
			throw new Error("Token function not set. Call setTokenFunction first.");
		}

		await this.disconnect();

		try {
			const { token, wsUrl } = await this.getTokenFn(locationId);

			this._room = new Room();
			this.currentLocationId = locationId;

			this._room.on(RoomEvent.DataReceived, this.handleDataReceived.bind(this));

			await this._room.connect(wsUrl, token);
		} catch (error) {
			this._room = null;
			this.currentLocationId = null;
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		if (this._room) {
			await this._room.disconnect();
			this._room = null;
		}
		this.currentLocationId = null;
	}

	subscribe(callback: (event: SyncEvent) => void): () => void {
		this.subscribers.add(callback);
		return () => this.subscribers.delete(callback);
	}

	private handleDataReceived(
		payload: Uint8Array,
		participant?: RemoteParticipant,
		kind?: any,
		topic?: string,
	): void {
		if (topic !== "sync") return;

		try {
			const text = new TextDecoder().decode(payload);
			const event = JSON.parse(text) as SyncEvent;
			
			for (const callback of this.subscribers) {
				callback(event);
			}
		} catch (error) {
			console.error("Error parsing sync event:", error);
		}
	}
}