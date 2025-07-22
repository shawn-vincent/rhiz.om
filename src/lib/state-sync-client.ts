import type {
	SpaceIntentions,
	SpacePresence,
	SyncError,
	VersionedState,
} from "~/lib/state-sync-types";
import type { BeingId } from "~/server/db/types";

// Re-export the types for convenience
export type { VersionedState, SpacePresence, SpaceIntentions, SyncError };

export class StateSyncClient<T> {
	private currentVersion = 0;
	private eventSource: EventSource | null = null;
	private onStateUpdate?: (state: VersionedState<T>) => void;
	private onError?: (error: SyncError) => void;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000; // Start with 1 second
	private reconnectTimer?: NodeJS.Timeout;
	private isConnected = false;
	private model = "";
	private spaceId = "";

	connect(model: string, spaceId: string) {
		this.model = model;
		this.spaceId = spaceId;
		this.startConnection();
	}

	private startConnection() {
		if (this.eventSource) {
			this.eventSource.close();
		}

		try {
			// Start SSE stream immediately
			this.eventSource = new EventSource(
				`/api/sync/stream?model=${this.model}&spaceId=${encodeURIComponent(this.spaceId)}`,
			);

			this.eventSource.onopen = () => {
				this.isConnected = true;
				this.reconnectAttempts = 0;
				this.reconnectDelay = 1000;
			};

			this.eventSource.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);

					if (data.error) {
						this.handleError({
							type: "connection_error",
							message: data.message || "Unknown error",
						});
						return;
					}

					const update: VersionedState<T> = data;
					this.handleUpdate(update);
				} catch (error) {
					console.error("Error parsing SSE message:", error);
					this.handleError({
						type: "connection_error",
						message: "Failed to parse server message",
					});
				}
			};

			this.eventSource.onerror = (event) => {
				console.error("SSE connection error:", event);
				this.isConnected = false;
				this.attemptReconnect();
			};

			// Request initial snapshot in parallel, but don't block the connection
			this.requestSnapshot().catch((error) => {
				console.error("Initial snapshot failed:", error);
				this.handleError({
					type: "connection_error",
					message: "Failed to fetch initial state",
				});
			});
		} catch (error) {
			console.error("Failed to create EventSource:", error);
			this.handleError({
				type: "connection_error",
				message: "Failed to establish connection",
			});
		}
	}

	private handleUpdate(update: VersionedState<T>) {
		// Ignore old or duplicate messages
		if (update.version <= this.currentVersion) {
			console.debug(
				`Ignoring old/duplicate message: ${update.version} (current: ${this.currentVersion})`,
			);
			return;
		}

		// Check for missed versions (gap in sequence)
		if (this.currentVersion > 0 && update.version !== this.currentVersion + 1) {
			console.warn(
				`Version gap detected: ${this.currentVersion} → ${update.version}`,
			);
			// Request snapshot to re-sync, but still process this update
			this.requestSnapshot().catch((error) => {
				console.error("Failed to request snapshot after version gap:", error);
			});
		}

		this.currentVersion = update.version;
		this.onStateUpdate?.(update);
	}

	private async requestSnapshot() {
		try {
			const response = await fetch(
				`/api/sync/snapshot?model=${this.model}&spaceId=${encodeURIComponent(this.spaceId)}`,
			);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const state: VersionedState<T> = await response.json();

			if ("error" in state) {
				this.handleError({
					type: "connection_error",
					message: (state as { error: string }).error,
				});
				return;
			}

			this.currentVersion = state.version;
			this.onStateUpdate?.(state);
		} catch (error) {
			console.error("Failed to request snapshot:", error);
			this.handleError({
				type: "connection_error",
				message: "Failed to fetch current state",
			});
		}
	}

	private attemptReconnect() {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.handleError({
				type: "connection_error",
				message: "Max reconnection attempts reached",
			});
			return;
		}

		this.reconnectAttempts++;
		const delay = Math.min(
			this.reconnectDelay * 2 ** (this.reconnectAttempts - 1),
			30000,
		);

		console.log(
			`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`,
		);

		this.reconnectTimer = setTimeout(() => {
			this.startConnection();
		}, delay);
	}

	private handleError(error: SyncError) {
		console.error("StateSyncClient error:", error);
		this.onError?.(error);
	}

	setStateUpdateHandler(handler: (state: VersionedState<T>) => void) {
		this.onStateUpdate = handler;
	}

	setErrorHandler(handler: (error: SyncError) => void) {
		this.onError = handler;
	}

	disconnect() {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}

		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}

		this.isConnected = false;
		this.currentVersion = 0;
	}

	getCurrentVersion(): number {
		return this.currentVersion;
	}

	isConnectionActive(): boolean {
		return this.isConnected;
	}
}
