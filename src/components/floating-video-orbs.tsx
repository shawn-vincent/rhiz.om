"use client";

import type { Room } from "livekit-client";
import { useEffect, useState } from "react";
import { VideoAvatar } from "~/components/ui/video-avatar";
import type { BeingId } from "~/lib/types";
import { cn } from "~/lib/utils";

interface FloatingVideoOrbsProps {
	participants: BeingId[];
	room: Room | null;
	className?: string;
}

export function FloatingVideoOrbs({
	participants,
	room,
	className,
}: FloatingVideoOrbsProps) {
	const [isVideoFocused, setIsVideoFocused] = useState(false);
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const updateDimensions = () => {
			setDimensions({ width: window.innerWidth, height: window.innerHeight });
		};
		updateDimensions();
		window.addEventListener("resize", updateDimensions);

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.code === "Space" && e.target === document.body) {
				e.preventDefault();
				setIsVideoFocused((prev) => !prev);
			}
		};
		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("resize", updateDimensions);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	if (!participants.length) return null;

	const minDimension = Math.min(dimensions.width, dimensions.height);
	const radius = minDimension * 0.35;
	const orbSize = Math.max(
		80,
		Math.min(200, (radius * Math.PI) / (participants.length * 1.5)),
	);

	return (
		<div
			className={cn(
				"fixed inset-0 transition-opacity duration-300",
				isVideoFocused
					? "pointer-events-auto z-20 opacity-100"
					: "pointer-events-auto z-0 opacity-40",
				className,
			)}
			onClick={() => setIsVideoFocused(!isVideoFocused)}
			onKeyDown={(e) => {
				if (e.code === "Enter") {
					setIsVideoFocused(!isVideoFocused);
				}
			}}
			role="button"
			tabIndex={0}
			aria-label="Toggle video focus mode"
		>
			{participants.map((beingId, i) => {
				const angle = (i / participants.length) * Math.PI * 2;
				const x = 50 + ((Math.cos(angle) * radius) / dimensions.width) * 100;
				const y = 50 + ((Math.sin(angle) * radius) / dimensions.height) * 100;

				return (
					<div
						key={beingId}
						className="pointer-events-none absolute overflow-hidden rounded-full shadow-lg ring-2 ring-white/50 transition-transform duration-500 hover:scale-110"
						style={{
							left: `${x}%`,
							top: `${y}%`,
							transform: "translate(-50%, -50%)",
							width: orbSize,
							height: orbSize,
						}}
					>
						<div className="h-full w-full [&>*]:!h-full [&>*]:!w-full">
							<VideoAvatar
								beingId={beingId}
								room={room}
								size="lg"
								className="pointer-events-none [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
							/>
						</div>
					</div>
				);
			})}
		</div>
	);
}
