'use client';

import { useCallback } from 'react';
import { LiveKitProvider } from '~/contexts/livekit-context';
import { useSpaceLiveKit } from '~/hooks/useSpaceLiveKit';

interface SpaceLiveKitProviderProps {
  spaceBeingId: string;
  children: React.ReactNode;
}

export function SpaceLiveKitProvider({ spaceBeingId, children }: SpaceLiveKitProviderProps) {
  // Auto-connect to LiveKit when this component mounts
  const livekit = useSpaceLiveKit({ 
    spaceBeingId, 
    autoConnect: true 
  });

  const sendMessage = useCallback(async (message: string) => {
    return livekit.sendMessage(spaceBeingId, message);
  }, [livekit.sendMessage, spaceBeingId]);

  const contextValue = {
    isConnected: livekit.isConnected,
    isConnecting: livekit.isConnecting,
    sendMessage,
    currentRoomId: spaceBeingId,
  };

  return (
    <LiveKitProvider value={contextValue}>
      {children}
    </LiveKitProvider>
  );
}