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
import { useState } from "react";
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
import { BeingPresence } from "./being-presence";
import { Config } from "./config";
import { SiteMenu } from "./site-menu";

export function BottomBar({ session }: { session?: Session | null }) {
	const [videoOn, setVideoOn] = useState(false);
	const [audioOn, setAudioOn] = useState(false);
	const [sharing, setSharing] = useState(false);
	const params = useParams();
	const currentSpaceId = params?.beingId
		? decodeURIComponent(params.beingId as string)
		: undefined;

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
								<Button variant="ghost" size="icon" aria-label="Open menu">
									<Menu className="size-5" />
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
								<SiteMenu />
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
						className="block truncate font-medium text-sm text-white"
						readOnly
					/>
				</div>

				{/* Right section - Controls and Overflow Menu */}
				<div className="flex shrink-0 items-center gap-1">
					<Toggle
						pressed={videoOn}
						onPressedChange={setVideoOn}
						aria-label={videoOn ? "Turn camera off" : "Turn camera on"}
						className={`${base} h-8 w-8`}
					>
						{videoOn ? (
							<Video className="size-4" />
						) : (
							<VideoOff className="size-4" />
						)}
					</Toggle>

					<Toggle
						pressed={audioOn}
						onPressedChange={setAudioOn}
						aria-label={audioOn ? "Mute microphone" : "Unmute microphone"}
						className={`${base} h-8 w-8`}
					>
						{audioOn ? (
							<Mic className="size-4" />
						) : (
							<MicOff className="size-4" />
						)}
					</Toggle>

					{session ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									aria-label="More options"
									className="ml-2 h-8 w-8"
								>
									<MoreHorizontal className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuItem
									onClick={() => setSharing(!sharing)}
									className="flex items-center gap-2"
								>
									{sharing ? (
										<MonitorX className="size-4" />
									) : (
										<MonitorUp className="size-4" />
									)}
									{sharing ? "Stop screen sharing" : "Start screen sharing"}
								</DropdownMenuItem>
								<Sheet>
									<SheetTrigger asChild>
										<DropdownMenuItem
											onSelect={(e) => e.preventDefault()}
											className="flex items-center gap-2"
										>
											<Settings className="size-4" />
											Space config
										</DropdownMenuItem>
									</SheetTrigger>
									<SheetContent
										side="right"
										className="w-72 border-l-white/20 bg-background/95 text-white"
									>
										<SheetHeader>
											<SheetTitle>Space Configuration</SheetTitle>
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
