"use client";

import { useEffect, useRef, useState } from "react";
import type { Room, LocalVideoTrack } from "livekit-client";
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
	const [cameraTrack, setCameraTrack] = useState<LocalVideoTrack | null>(null);

	const sizeClass = sizeClasses[size];

	// Track the local participant's camera track
	useEffect(() => {
		if (!room) {
			setHasVideo(false);
			setCameraTrack(null);
			return;
		}

		const updateCameraTrack = () => {
			const localParticipant = room.localParticipant;
			const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera);
			
			if (cameraPublication?.track && !cameraPublication.isMuted) {
				const track = cameraPublication.track as LocalVideoTrack;
				setCameraTrack(track);
				setHasVideo(true);
			} else {
				setCameraTrack(null);
				setHasVideo(false);
			}
		};

		// Initial check
		updateCameraTrack();

		// Listen for track changes
		const handleTrackPublished = () => updateCameraTrack();
		const handleTrackUnpublished = () => updateCameraTrack();
		const handleTrackMuted = () => updateCameraTrack();
		const handleTrackUnmuted = () => updateCameraTrack();

		room.on(RoomEvent.LocalTrackPublished, handleTrackPublished);
		room.on(RoomEvent.LocalTrackUnpublished, handleTrackUnpublished);
		room.on(RoomEvent.TrackMuted, handleTrackMuted);
		room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);

		return () => {
			room.off(RoomEvent.LocalTrackPublished, handleTrackPublished);
			room.off(RoomEvent.LocalTrackUnpublished, handleTrackUnpublished);
			room.off(RoomEvent.TrackMuted, handleTrackMuted);
			room.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);
		};
	}, [room]);

	// Attach video stream to video element
	useEffect(() => {
		if (!videoRef.current || !cameraTrack) return;

		const videoElement = videoRef.current;
		
		try {
			cameraTrack.attach(videoElement);
		} catch (error) {
			console.error("Failed to attach video track:", error);
		}

		return () => {
			try {
				cameraTrack.detach(videoElement);
			} catch (error) {
				console.error("Failed to detach video track:", error);
			}
		};
	}, [cameraTrack]);

	// If we have video, show video element instead of avatar
	if (hasVideo && cameraTrack) {
		return (
			<div className={cn("relative overflow-hidden rounded-full", sizeClass, className)}>
				<video
					ref={videoRef}
					className={cn(
						"h-full w-full object-cover",
						mirrored && "scale-x-[-1]" // Mirror the video horizontally
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