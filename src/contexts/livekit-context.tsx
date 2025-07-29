'use client';

import { createContext, useContext } from 'react';

interface LiveKitContextValue {
  isConnected: boolean;
  isConnecting: boolean;
  sendMessage: (message: string) => Promise<void>;
  currentRoomId?: string;
}

const LiveKitContext = createContext<LiveKitContextValue | null>(null);

export function useLiveKitContext() {
  const context = useContext(LiveKitContext);
  if (!context) {
    throw new Error('useLiveKitContext must be used within a LiveKitProvider');
  }
  return context;
}

export const LiveKitProvider = LiveKitContext.Provider;