// src/app/_components/bottom-bar.tsx
"use client";

import {
	Menu,
	Mic,
	MicOff,
	MonitorUp,
	MonitorX,
	Settings,
	Video,
	VideoOff,
} from "lucide-react";
import type { Session } from "next-auth";
import Link from "next/link";
import { useState } from "react";
import { InlineBeingName } from "~/components/inline-being-name";
import { Button } from "~/components/ui/button";
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
import { Config } from "./config";
import { SiteMenu } from "./site-menu";

export function BottomBar({ session }: { session?: Session | null }) {
	const [videoOn, setVideoOn] = useState(false);
	const [audioOn, setAudioOn] = useState(false);
	const [sharing, setSharing] = useState(false);

	const base =
		"size-10 rounded-full transition-colors text-white data-[state=on]:bg-white/20 hover:bg-white/10";
	return (
		<ErrorBoundary>
			<nav className="sticky bottom-0 z-50 flex items-center gap-2 border-white/20 border-t bg-background/95 px-2 py-2 min-w-0">
				{/* Left section - Menu */}
				<div className="flex items-center shrink-0">
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
				</div>

				{/* Center section - Controls and Title */}
				<div className="flex items-center gap-1 flex-1 min-w-0 justify-center">
					<Toggle
						pressed={videoOn}
						onPressedChange={setVideoOn}
						aria-label={videoOn ? "Turn camera off" : "Turn camera on"}
						className={base}
					>
						{videoOn ? (
							<Video className="size-5" />
						) : (
							<VideoOff className="size-5" />
						)}
					</Toggle>

					<Toggle
						pressed={audioOn}
						onPressedChange={setAudioOn}
						aria-label={audioOn ? "Mute microphone" : "Unmute microphone"}
						className={base}
					>
						{audioOn ? (
							<Mic className="size-5" />
						) : (
							<MicOff className="size-5" />
						)}
					</Toggle>

					<Toggle
						pressed={sharing}
						onPressedChange={setSharing}
						aria-label={
							sharing ? "Stop screen sharing" : "Start screen sharing"
						}
						className={base}
					>
						{sharing ? (
							<MonitorX className="size-5" />
						) : (
							<MonitorUp className="size-5" />
						)}
					</Toggle>

					<div className="mx-2 min-w-0 flex-1 text-center">
						<InlineBeingName
							fallback="Rhiz.om"
							className="font-medium text-sm text-white truncate block"
						/>
					</div>
				</div>

				{/* Right section - Settings */}
				<div className="flex items-center shrink-0">
					{session ? (
						<Sheet>
							<SheetTrigger asChild>
								<Button variant="ghost" size="icon" aria-label="Page settings">
									<Settings className="size-5" />
								</Button>
							</SheetTrigger>
							<SheetContent
								side="right"
								className="w-72 border-l-white/20 bg-background/95 text-white"
							>
								<SheetHeader>
									<SheetTitle>Page Configuration</SheetTitle>
									<SheetDescription>
										Manage the settings for the current page.
									</SheetDescription>
								</SheetHeader>
								<Config />
							</SheetContent>
						</Sheet>
					) : (
						<Link
							href="/api/auth/signin"
							className="rounded-full bg-white/10 px-6 py-2 font-semibold text-sm no-underline transition hover:bg-white/20"
						>
							Sign in
						</Link>
					)}
				</div>
			</nav>
		</ErrorBoundary>
	);
}
