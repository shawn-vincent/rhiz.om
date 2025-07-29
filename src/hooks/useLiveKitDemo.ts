'use client';

import { useRef, useCallback, useState } from 'react';
import { Room, RoomEvent, type RemoteParticipant } from 'livekit-client';
import { api } from '~/trpc/react';
import { toast } from '~/lib/toast';
import { logger } from '~/lib/logger.client';

const livekitLogger = logger.child({ name: 'LiveKit' });

export interface TestMessage {
  type: 'test_message';
  fromBeingId: string;
  fromBeingName?: string;
  message: string;
  timestamp: string;
}

export function useLiveKitDemo() {
  const roomRef = useRef<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const getJoinToken = api.livekit.getJoinToken.useMutation();
  const sendTestMessage = api.livekit.sendTestMessage.useMutation();

  const connect = useCallback(async (roomBeingId: string) => {
    if (isConnecting || isConnected) return;
    
    setIsConnecting(true);
    
    try {
      // Get join token from our tRPC endpoint
      const { token, wsUrl } = await getJoinToken.mutateAsync({
        roomBeingId
      });

      // Create and connect to LiveKit room
      const room = new Room();
      
      // Set up event listeners
      room.on(RoomEvent.Connected, () => {
        livekitLogger.info({ roomBeingId }, 'Connected to room');
        setIsConnected(true);
      });

      room.on(RoomEvent.Disconnected, () => {
        livekitLogger.info('Disconnected from room');
        setIsConnected(false);
      });

      room.on(RoomEvent.DataReceived, (
        payload: Uint8Array,
        participant?: RemoteParticipant,
        kind?: any,
        topic?: string
      ) => {
        try {
          const text = new TextDecoder().decode(payload);
          
          if (topic === 'demo') {
            const message: TestMessage = JSON.parse(text);
            console.log('Received test message:', message);
            
            // Show toast notification for incoming messages - use participant name if available
            const senderName = participant?.name || message.fromBeingName || message.fromBeingId;
            toast.message(`LiveKit Message from ${senderName}`, {
              description: message.message,
            });
          }
        } catch (error) {
          console.error('Error parsing received data:', error);
          toast.error('Failed to parse LiveKit message');
        }
      });

      // Connect to LiveKit
      await room.connect(wsUrl, token);
      roomRef.current = room;
      
    } catch (error) {
      console.error('Failed to connect to LiveKit room:', error);
      setIsConnected(false);
      toast.error('Failed to connect to LiveKit room');
    } finally {
      setIsConnecting(false);
    }
  }, [getJoinToken, isConnecting, isConnected]);

  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback(async (roomBeingId: string, message: string) => {
    try {
      await sendTestMessage.mutateAsync({
        roomBeingId,
        message,
      });
      toast.success('Test message sent via LiveKit');
    } catch (error) {
      console.error('Failed to send test message:', error);
      toast.error('Failed to send test message');
    }
  }, [sendTestMessage]);

  return {
    connect,
    disconnect,
    sendMessage,
    isConnected,
    isConnecting,
  };
}