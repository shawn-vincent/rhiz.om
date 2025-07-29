"use client";

import { Track, RoomEvent } from "livekit-client";
import type { Room } from "livekit-client";
import { useEffect, useState } from "react";
import { logger } from "~/lib/logger.client";
import { toast } from "~/lib/toast";

const mediaLogger = logger.child({ name: "LiveKitMediaControls" });

export interface MediaControlsState {
	// Camera controls
	isCameraEnabled: boolean;
	isCameraPending: boolean;
	toggleCamera: (forceState?: boolean) => Promise<void>;

	// Microphone controls
	isMicrophoneEnabled: boolean;
	isMicrophonePending: boolean;
	toggleMicrophone: (forceState?: boolean) => Promise<void>;

	// Screen share controls
	isScreenShareEnabled: boolean;
	isScreenSharePending: boolean;
	toggleScreenShare: (forceState?: boolean) => Promise<void>;

	// Overall state
	hasPermissions: boolean;
}

export function useLiveKitMediaControls(room: Room | null): MediaControlsState {
	// Camera state
	const [isCameraEnabled, setIsCameraEnabled] = useState(false);
	const [isCameraPending, setIsCameraPending] = useState(false);

	// Microphone state
	const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
	const [isMicrophonePending, setIsMicrophonePending] = useState(false);

	// Screen share state
	const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
	const [isScreenSharePending, setIsScreenSharePending] = useState(false);

	// Permissions
	const [hasPermissions, setHasPermissions] = useState(false);

	// Set up track subscriptions to sync state with actual track status
	useEffect(() => {
		if (!room) {
			setHasPermissions(false);
			setIsCameraEnabled(false);
			setIsMicrophoneEnabled(false);
			setIsScreenShareEnabled(false);
			return;
		}

		setHasPermissions(true);

		const updateTrackStates = () => {
			const localParticipant = room.localParticipant;

			// Use the participant's built-in state properties which match setCameraEnabled API
			setIsCameraEnabled(localParticipant.isCameraEnabled);
			setIsMicrophoneEnabled(localParticipant.isMicrophoneEnabled);
			setIsScreenShareEnabled(localParticipant.isScreenShareEnabled);

			// Debug logging
			mediaLogger.debug({
				camera: localParticipant.isCameraEnabled,
				microphone: localParticipant.isMicrophoneEnabled,
				screenShare: localParticipant.isScreenShareEnabled,
			}, "Updated track states");
		};

		// Initial state
		updateTrackStates();

		// Listen for track events to update state - these are Room events, not participant events
		const handleLocalTrackPublished = (publication: any, participant: any) => {
			mediaLogger.debug({ source: publication.source }, "Local track published");
			updateTrackStates();
		};
		const handleLocalTrackUnpublished = (publication: any, participant: any) => {
			mediaLogger.debug({ source: publication.source }, "Local track unpublished");
			updateTrackStates();
		};
		const handleLocalTrackMuted = (publication: any, participant: any) => {
			mediaLogger.debug({ source: publication.source }, "Local track muted");
			updateTrackStates();
		};
		const handleLocalTrackUnmuted = (publication: any, participant: any) => {
			mediaLogger.debug({ source: publication.source }, "Local track unmuted");
			updateTrackStates();
		};

		// Use proper RoomEvent constants
		room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
		room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
		room.on(RoomEvent.TrackMuted, handleLocalTrackMuted);
		room.on(RoomEvent.TrackUnmuted, handleLocalTrackUnmuted);

		return () => {
			room.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
			room.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
			room.off(RoomEvent.TrackMuted, handleLocalTrackMuted);
			room.off(RoomEvent.TrackUnmuted, handleLocalTrackUnmuted);
		};
	}, [room]);

	// Toggle functions
	const toggleCamera = async (forceState?: boolean) => {
		if (!room) {
			mediaLogger.warn("Camera toggle not available - no room connection");
			return;
		}

		setIsCameraPending(true);
		try {
			const targetState = forceState ?? !isCameraEnabled;
			await room.localParticipant.setCameraEnabled(targetState);
			mediaLogger.info({ targetState }, "Camera toggled");
		} catch (error) {
			mediaLogger.error({ error, forceState }, "Failed to toggle camera");
			toast.error("Failed to toggle camera");
		} finally {
			setIsCameraPending(false);
		}
	};

	const toggleMicrophone = async (forceState?: boolean) => {
		if (!room) {
			mediaLogger.warn("Microphone toggle not available - no room connection");
			return;
		}

		setIsMicrophonePending(true);
		try {
			const targetState = forceState ?? !isMicrophoneEnabled;
			await room.localParticipant.setMicrophoneEnabled(targetState);
			mediaLogger.info({ targetState }, "Microphone toggled");
		} catch (error) {
			mediaLogger.error({ error, forceState }, "Failed to toggle microphone");
			toast.error("Failed to toggle microphone");
		} finally {
			setIsMicrophonePending(false);
		}
	};

	const toggleScreenShare = async (forceState?: boolean) => {
		if (!room) {
			mediaLogger.warn(
				"Screen share toggle not available - no room connection",
			);
			return;
		}

		setIsScreenSharePending(true);
		try {
			const targetState = forceState ?? !isScreenShareEnabled;
			await room.localParticipant.setScreenShareEnabled(targetState);
			mediaLogger.info({ targetState }, "Screen share toggled");
		} catch (error) {
			mediaLogger.error({ error, forceState }, "Failed to toggle screen share");
			toast.error("Failed to toggle screen share");
		} finally {
			setIsScreenSharePending(false);
		}
	};

	return {
		// Camera
		isCameraEnabled,
		isCameraPending,
		toggleCamera,

		// Microphone
		isMicrophoneEnabled,
		isMicrophonePending,
		toggleMicrophone,

		// Screen share
		isScreenShareEnabled,
		isScreenSharePending,
		toggleScreenShare,

		// Overall state
		hasPermissions,
	};
}
