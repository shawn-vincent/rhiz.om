// src/app/_components/bottom-bar.tsx
"use client";

import { useState } from "react";
import { Mic, MicOff, MonitorUp, MonitorX, Video, VideoOff } from "lucide-react";
import { Toggle } from "~/components/ui/toggle";

export function BottomBar() {
  const [videoOn, setVideoOn] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [sharing, setSharing] = useState(false);

  const base =
    "size-12 rounded-full transition-colors text-white data-[state=on]:bg-white/20 hover:bg-white/10";
          return (
            <nav className="sticky bottom-0 z-50 flex justify-center gap-4 border-t border-white/20 bg-background/80 py-2 backdrop-blur">
              <Toggle
                pressed={videoOn}
                onPressedChange={setVideoOn}
                aria-label={videoOn ? "Turn camera off" : "Turn camera on"}
                className={base}
              >
                {videoOn ? <Video className="size-6" /> : <VideoOff className="size-6" />}
              </Toggle>
         
              <Toggle
                pressed={audioOn}
                onPressedChange={setAudioOn}
                aria-label={audioOn ? "Mute microphone" : "Unmute microphone"}
                className={base}
              >
                {audioOn ? <Mic className="size-6" /> : <MicOff className="size-6" />}
              </Toggle>
         
              <Toggle
                pressed={sharing}
                onPressedChange={setSharing}
                aria-label={sharing ? "Stop screen sharing" : "Start screen sharing"}
                className={base}
              >
                {sharing ? (
                  <MonitorX className="size-6" />
                ) : (
                  <MonitorUp className="size-6" />
                )}
              </Toggle>
            </nav>
  );
}