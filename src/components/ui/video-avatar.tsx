"use client";

import { useEffect, useRef, useState } from "react";
import type { Room, LocalVideoTrack, RemoteVideoTrack, TrackPublication, RemoteParticipant } from "livekit-client";
import { RoomEvent, Track } from "livekit-client";
import { Avatar, type BeingType } from "./avatar";
import type { BeingId } from "~/lib/types";
import { cn } from "~/lib/utils";

interface VideoAvatarProps {
	beingId?: BeingId;
	beingType?: BeingType;
	size?: "sm" | "md" | "lg";
	className?: string;
	autoDetectType?: boolean;
	showSuperuserBadge?: boolean;
	room?: Room | null;
	/** Show mirrored video for self-view */
	mirrored?: boolean;
}

const sizeClasses = {
	sm: "size-8", // 32px
	md: "size-10", // 40px  
	lg: "size-12", // 48px
};

export function VideoAvatar({
	beingId,
	beingType,
	size = "md",
	className,
	autoDetectType = false,
	showSuperuserBadge = false,
	room,
	mirrored = true,
}: VideoAvatarProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [hasVideo, setHasVideo] = useState(false);
	const [videoTrack, setVideoTrack] = useState<LocalVideoTrack | RemoteVideoTrack | null>(null);

	const sizeClass = sizeClasses[size];

	// Determine if this is the local participant or a remote participant
	const isLocal = !beingId || room?.localParticipant?.identity === beingId;

	// Track camera track for both local and remote participants
	useEffect(() => {
		if (!room || !beingId) {
			setHasVideo(false);
			setVideoTrack(null);
			return;
		}

		const updateCameraTrack = () => {
			let cameraPublication: TrackPublication | undefined;
			
			if (isLocal) {
				// Local participant
				cameraPublication = room.localParticipant.getTrackPublication(Track.Source.Camera);
			} else {
				// Remote participant - find by identity
				const remoteParticipant = Array.from(room.remoteParticipants.values())
					.find(p => p.identity === beingId);
				
				if (remoteParticipant) {
					cameraPublication = remoteParticipant.getTrackPublication(Track.Source.Camera);
				}
			}
			
			// Check if track is available, subscribed, and not muted
			if (cameraPublication?.track && cameraPublication.isSubscribed && !cameraPublication.isMuted) {
				const track = cameraPublication.track as LocalVideoTrack | RemoteVideoTrack;
				setVideoTrack(track);
				setHasVideo(true);
			} else {
				setVideoTrack(null);
				setHasVideo(false);
			}
		};

		// Initial check
		updateCameraTrack();

		// Listen for track changes
		const handleTrackPublished = () => updateCameraTrack();
		const handleTrackUnpublished = () => updateCameraTrack();
		const handleTrackSubscribed = () => updateCameraTrack();
		const handleTrackUnsubscribed = () => updateCameraTrack();
		const handleTrackMuted = () => updateCameraTrack();
		const handleTrackUnmuted = () => updateCameraTrack();
		const handleParticipantConnected = () => updateCameraTrack();
		const handleParticipantDisconnected = () => updateCameraTrack();

		// Listen to both local and remote track events
		room.on(RoomEvent.LocalTrackPublished, handleTrackPublished);
		room.on(RoomEvent.LocalTrackUnpublished, handleTrackUnpublished);
		room.on(RoomEvent.TrackPublished, handleTrackPublished);
		room.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);
		room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
		room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
		room.on(RoomEvent.TrackMuted, handleTrackMuted);
		room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);
		room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
		room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

		return () => {
			room.off(RoomEvent.LocalTrackPublished, handleTrackPublished);
			room.off(RoomEvent.LocalTrackUnpublished, handleTrackUnpublished);
			room.off(RoomEvent.TrackPublished, handleTrackPublished);
			room.off(RoomEvent.TrackUnpublished, handleTrackUnpublished);
			room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
			room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
			room.off(RoomEvent.TrackMuted, handleTrackMuted);
			room.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);
			room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
			room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
		};
	}, [room, beingId, isLocal]);

	// Attach video stream to video element
	useEffect(() => {
		if (!videoRef.current || !videoTrack) return;

		const videoElement = videoRef.current;
		
		try {
			videoTrack.attach(videoElement);
		} catch (error) {
			console.error("Failed to attach video track:", error);
		}

		return () => {
			try {
				videoTrack.detach(videoElement);
			} catch (error) {
				console.error("Failed to detach video track:", error);
			}
		};
	}, [videoTrack]);

	// If we have video, show video element instead of avatar
	if (hasVideo && videoTrack) {
		return (
			<div className={cn("relative overflow-hidden rounded-full", sizeClass, className)}>
				<video
					ref={videoRef}
					className={cn(
						"h-full w-full object-cover",
						mirrored && "scale-x-[-1]" // Mirror the video horizontally for self-view
					)}
					autoPlay
					muted
					playsInline
				/>
			</div>
		);
	}

	// Fallback to normal avatar when no video
	return (
		<Avatar
			beingId={beingId}
			beingType={beingType}
			size={size}
			className={className}
			autoDetectType={autoDetectType}
			showSuperuserBadge={showSuperuserBadge}
		/>
	);
}