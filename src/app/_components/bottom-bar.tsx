// src/app/_components/bottom-bar.tsx
"use client";

import {
	Menu,
	Mic,
	MicOff,
	MonitorUp,
	MonitorX,
	MoreHorizontal,
	Settings,
	Video,
	VideoOff,
} from "lucide-react";
import type { Session } from "next-auth";
import Link from "next/link";
import { useParams } from "next/navigation";
import { InlineBeingName } from "~/components/inline-being-name";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import ErrorBoundary from "~/components/ui/error-boundary";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/components/ui/sheet";
import { Toggle } from "~/components/ui/toggle";
import { useSync } from "~/hooks/use-sync";
import { useLiveKitMediaControls } from "~/hooks/useLiveKitMediaControls";
import { type BeingId, isBeingId } from "~/lib/types";
import { BeingPresence } from "./being-presence";
import { Config } from "./config";
import { SiteMenu } from "./site-menu";

export function BottomBar({ session }: { session?: Session | null }) {
	const params = useParams();
	const currentSpaceId: BeingId | undefined = params?.beingId
		? (() => {
				const decoded = decodeURIComponent(params.beingId as string);
				return isBeingId(decoded) ? decoded : undefined;
			})()
		: undefined;

	const sync = useSync(currentSpaceId || "@default-space");
	const mediaControls = useLiveKitMediaControls(sync.room);

	const base =
		"rounded-full transition-colors text-white data-[state=on]:bg-white/20 hover:bg-white/10";
	return (
		<ErrorBoundary>
			<nav className="sticky bottom-0 z-50 flex min-w-0 items-center gap-2 border-white/20 border-t bg-background/95 px-2 py-2">
				{/* Left section - Menu + Compact Presence */}
				<div className="flex shrink-0 items-center gap-4">
					{session && (
						<Sheet>
							<SheetTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									aria-label="Open menu"
									title="Open menu"
									className="h-10 w-10"
								>
									<Menu className="size-6" />
								</Button>
							</SheetTrigger>
							<SheetContent
								side="left"
								className="w-72 border-r-white/20 bg-background/95 text-white"
							>
								<SheetHeader>
									<SheetTitle>Site Menu</SheetTitle>
									<SheetDescription>
										Navigate to different parts of the site.
									</SheetDescription>
								</SheetHeader>
								<SiteMenu currentSpaceId={currentSpaceId} />
							</SheetContent>
						</Sheet>
					)}
					{/* Compact presence indicator for mobile */}
					<div className="sm:hidden">
						<BeingPresence compact currentSpaceId={currentSpaceId} />
					</div>
				</div>

				{/* Center section - Being Name */}
				<div className="min-w-0 flex-1 text-center">
					<InlineBeingName
						fallback="Rhiz.om"
						className="block truncate font-medium text-base text-white"
						readOnly
					/>
				</div>

				{/* Right section - Controls and Overflow Menu */}
				<div className="flex shrink-0 items-center gap-1">
					<Toggle
						pressed={mediaControls.isCameraEnabled}
						onPressedChange={() => mediaControls.toggleCamera()}
						disabled={
							mediaControls.isCameraPending || !mediaControls.hasPermissions
						}
						aria-label={
							mediaControls.isCameraEnabled
								? "Turn camera off"
								: "Turn camera on"
						}
						title={
							mediaControls.isCameraEnabled
								? "Turn camera off"
								: "Turn camera on"
						}
						className={`${base} h-10 w-10`}
					>
						{mediaControls.isCameraEnabled ? (
							<Video className="size-6" />
						) : (
							<VideoOff className="size-6" />
						)}
					</Toggle>

					<Toggle
						pressed={mediaControls.isMicrophoneEnabled}
						onPressedChange={() => mediaControls.toggleMicrophone()}
						disabled={
							mediaControls.isMicrophonePending || !mediaControls.hasPermissions
						}
						aria-label={
							mediaControls.isMicrophoneEnabled
								? "Mute microphone"
								: "Unmute microphone"
						}
						title={
							mediaControls.isMicrophoneEnabled
								? "Mute microphone"
								: "Unmute microphone"
						}
						className={`${base} h-10 w-10`}
					>
						{mediaControls.isMicrophoneEnabled ? (
							<Mic className="size-6" />
						) : (
							<MicOff className="size-6" />
						)}
					</Toggle>

					{session ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									aria-label="More options"
									title="More options"
									className="ml-2 h-10 w-10"
								>
									<MoreHorizontal className="size-6" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuItem
									onClick={() => mediaControls.toggleScreenShare()}
									disabled={
										mediaControls.isScreenSharePending ||
										!mediaControls.hasPermissions
									}
									className="flex items-center gap-2 text-base"
								>
									{mediaControls.isScreenShareEnabled ? (
										<MonitorX className="size-5" />
									) : (
										<MonitorUp className="size-5" />
									)}
									{mediaControls.isScreenShareEnabled
										? "Stop Share"
										: "Share Screen"}
								</DropdownMenuItem>
								<Sheet>
									<SheetTrigger asChild>
										<DropdownMenuItem
											onSelect={(e) => e.preventDefault()}
											className="flex items-center gap-2 text-base"
										>
											<Settings className="size-5" />
											Space Config
										</DropdownMenuItem>
									</SheetTrigger>
									<SheetContent
										side="right"
										className="w-72 border-l-white/20 bg-background/95 text-white"
									>
										<SheetHeader>
											<SheetTitle>Space Config</SheetTitle>
											<SheetDescription>
												Manage the settings for the current space.
											</SheetDescription>
										</SheetHeader>
										<Config />
									</SheetContent>
								</Sheet>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<Link
							href="/api/auth/signin"
							className="ml-2 whitespace-nowrap rounded-full bg-white/10 px-3 py-1 font-semibold text-xs no-underline transition hover:bg-white/20"
						>
							Sign in
						</Link>
					)}
				</div>
			</nav>
		</ErrorBoundary>
	);
}
