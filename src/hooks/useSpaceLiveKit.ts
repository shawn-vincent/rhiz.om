'use client';

import { useEffect, useRef } from 'react';
import { useLiveKitDemo } from './useLiveKitDemo';

interface UseSpaceLiveKitProps {
  spaceBeingId: string;
  autoConnect?: boolean;
}

export function useSpaceLiveKit({ spaceBeingId, autoConnect = true }: UseSpaceLiveKitProps) {
  const livekit = useLiveKitDemo();
  const currentRoomRef = useRef<string | null>(null);

  useEffect(() => {
    // Only connect if we're not already connected to this room
    if (autoConnect && spaceBeingId && currentRoomRef.current !== spaceBeingId) {
      // Disconnect from previous room if connected
      if (currentRoomRef.current) {
        livekit.disconnect();
      }
      
      // Connect to new room
      livekit.connect(spaceBeingId);
      currentRoomRef.current = spaceBeingId;
    }

    return () => {
      // Only disconnect if we're still connected to this room
      if (currentRoomRef.current === spaceBeingId) {
        livekit.disconnect();
        currentRoomRef.current = null;
      }
    };
  }, [spaceBeingId, autoConnect]); // Removed livekit functions from deps

  return livekit;
}