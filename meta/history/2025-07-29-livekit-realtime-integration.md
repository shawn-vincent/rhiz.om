# LiveKit Real-time Integration for rhiz.om

*2025-07-29 - Specialized LiveKit cookbook for rhiz.om's Being/Intention architecture*

## Overview

This document provides a complete walkthrough for integrating LiveKit real-time data transmission into rhiz.om, specialized for our unique Being/Intention entity system. We'll implement chat-style data transmission that leverages our existing T3 stack architecture with tRPC, Drizzle ORM, and NextAuth.js.

**Key Integration Points:**
- **Room = Being Space**: Each LiveKit room corresponds directly to a Being of type "space" - when a user visits `/beings/@some-space`, they can connect to LiveKit room `@some-space`
- **User Identity = Being ID**: LiveKit participant identity uses the logged-in user's Being ID from `ctx.auth.beingId`
- Real-time messages flow through our Intention system
- Server-side token generation with Being-based identity
- tRPC procedures for LiveKit operations
- Integration with existing authentication

## Environment Setup

Your `.env` already contains the required LiveKit configuration:

```bash
LIVEKIT_HOST=wss://rhizom-c9drvm15.livekit.cloud     # Server API host
LIVEKIT_WS_URL=wss://rhizom-c9drvm15.livekit.cloud   # WebSocket URL for client
LIVEKIT_API_KEY=APInxUoPVe4Qz8q                      # API key
LIVEKIT_API_SECRET=9UHHE63H3a9cuz89vexLvezXk7AwsgMnk1oceGze135B # API secret
```

We need to add these to your `src/env.js` validation schema:

```typescript
// Add to server section
LIVEKIT_HOST: z.string().url(),
LIVEKIT_WS_URL: z.string().url(), 
LIVEKIT_API_KEY: z.string(),
LIVEKIT_API_SECRET: z.string(),

// Add to runtimeEnv section
LIVEKIT_HOST: process.env.LIVEKIT_HOST,
LIVEKIT_WS_URL: process.env.LIVEKIT_WS_URL,
LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
```

## Core LiveKit Service

**`src/server/lib/livekit.ts`**

```typescript
import {
  AccessToken,
  RoomServiceClient,
  type VideoGrant,
  DataPacket_Kind,
} from 'livekit-server-sdk';
import { env } from '~/env';

// Server API host (HTTPS) for RoomServiceClient
const HOST = env.LIVEKIT_HOST.replace('wss://', 'https://');
const API_KEY = env.LIVEKIT_API_KEY;
const API_SECRET = env.LIVEKIT_API_SECRET;
const WS_URL = env.LIVEKIT_WS_URL; // WebSocket URL for client connections

export const roomService = new RoomServiceClient(HOST, API_KEY, API_SECRET);

export interface JoinTokenOptions {
  roomId: string;        // Being ID for the space/room (e.g., "@some-space")
  identity: string;      // Being ID for the logged-in user (from ctx.auth.beingId)
  name?: string;         // Display name for the user
  ttlSeconds?: number;   // Token expiry (default 1 hour)
  grants?: Partial<VideoGrant>;
}

/**
 * Generate a LiveKit join token for a user Being to join a space Being
 * 
 * Room Mapping: LiveKit roomId = Being ID of the space page user is visiting
 * User Identity: LiveKit identity = Being ID of the authenticated user
 * 
 * Example: User with Being ID "@alice" visits space page "/beings/@workspace"
 * → Connects to LiveKit room "@workspace" with identity "@alice"
 */
export function createJoinToken(opts: JoinTokenOptions) {
  const { roomId, identity, name, ttlSeconds = 3600, grants = {} } = opts;

  const at = new AccessToken(API_KEY, API_SECRET, { 
    identity, 
    ttl: ttlSeconds 
  });
  
  if (name) at.name = name;

  // Grant permissions for data-only chat (no audio/video for now)
  const grant: VideoGrant = {
    roomJoin: true,
    room: roomId,
    canPublish: false,        // No audio/video publishing
    canPublishData: true,     // Allow data publishing
    canSubscribe: true,       // Allow data subscription
    ...grants,
  };
  
  at.addGrant(grant);
  
  return {
    token: at.toJwt(),
    wsUrl: WS_URL,
    roomId,
    identity
  };
}

export interface BroadcastOptions {
  roomId: string;           // Being ID for the room
  text: string;            // Message content
  topic?: string;          // Message topic/type
  toIdentities?: string[]; // Target specific Being IDs
}

/**
 * Broadcast a message from server to all participants in a room
 * Used for system messages, bot responses, etc.
 */
export async function broadcastToRoom(opts: BroadcastOptions) {
  const { roomId, text, topic = 'chat', toIdentities } = opts;
  
  const payload = new TextEncoder().encode(text);
  
  await roomService.sendData(roomId, payload, DataPacket_Kind.RELIABLE, {
    topic,
    destinationIdentities: toIdentities,
  });
  
  return { success: true, roomId, topic };
}
```

## tRPC LiveKit Router

**`src/server/api/routers/livekit.ts`**

```typescript
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { services } from "~/domain/services";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { createJoinToken, broadcastToRoom } from "~/server/lib/livekit";

export const livekitRouter = createTRPCRouter({
  /**
   * Generate a LiveKit join token for the current user to connect to a space
   * 
   * Room Mapping: The roomBeingId should match the Being ID of the space page
   * the user is currently viewing (e.g., from URL "/beings/@workspace")
   * 
   * User Identity: Uses ctx.auth.beingId as the LiveKit participant identity
   */
  getJoinToken: protectedProcedure
    .input(z.object({
      roomBeingId: z.string().min(1),     // Being ID for the space (from current page)
      ttlSeconds: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the space Being exists and user has access
      const spaceBeing = await services.being.getBeing(input.roomBeingId);
      if (!spaceBeing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Space being not found"
        });
      }

      // Verify space is actually a space type
      if (spaceBeing.type !== 'space') {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Being must be of type 'space' to use as LiveKit room"
        });
      }

      // Get the user's Being for display name
      const userBeing = await services.being.getBeing(ctx.auth.beingId);
      if (!userBeing) {
        throw new TRPCError({
          code: "UNAUTHORIZED", 
          message: "User being not found"
        });
      }

      // Generate token: room = space Being ID, identity = user Being ID
      const result = createJoinToken({
        roomId: input.roomBeingId,        // Space Being ID (e.g., "@workspace")
        identity: ctx.auth.beingId,       // User Being ID (e.g., "@alice")
        name: userBeing.name,             // Display name for LiveKit
        ttlSeconds: input.ttlSeconds,
      });

      return result;
    }),

  /**
   * Send a server-side message to a LiveKit room
   * Useful for system notifications, bot messages, etc.
   */
  sendSystemMessage: protectedProcedure
    .input(z.object({
      roomBeingId: z.string().min(1),
      message: z.string().min(1),
      topic: z.string().optional(),
      targetBeingIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user has permission to send to this room
      const roomBeing = await services.being.getBeing(input.roomBeingId);
      if (!roomBeing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Room being not found"
        });
      }

      // For now, allow any authenticated user to send system messages
      // TODO: Add proper permission checks based on room ownership/membership

      await broadcastToRoom({
        roomId: input.roomBeingId,
        text: input.message,
        topic: input.topic,
        toIdentities: input.targetBeingIds,
      });

      return { success: true };
    }),

  /**
   * Demo endpoint: Send a test message to LiveKit room
   * For testing real-time data transmission only
   */
  sendTestMessage: protectedProcedure
    .input(z.object({
      roomBeingId: z.string().min(1),
      message: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Broadcast test message via LiveKit
      await broadcastToRoom({
        roomId: input.roomBeingId,
        text: JSON.stringify({
          type: 'test_message',
          fromBeingId: ctx.auth.beingId,
          message: input.message,
          timestamp: new Date().toISOString(),
        }),
        topic: 'demo',
      });

      return { success: true };
    }),
});
```

## Update Root Router

**`src/server/api/root.ts`**

```typescript
import { authRouter } from "~/server/api/routers/auth";
import { beingRouter } from "~/server/api/routers/being";
import { intentionRouter } from "~/server/api/routers/intention";
import { livekitRouter } from "~/server/api/routers/livekit"; // Add import
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  intention: intentionRouter,
  being: beingRouter,
  auth: authRouter,
  livekit: livekitRouter, // Add router
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
```

## Demo Hook with Toast Notifications

**`src/hooks/useLiveKitDemo.ts`**

```typescript
'use client';

import { useRef, useCallback, useState } from 'react';
import { Room, RoomEvent, type DataPacket, type RemoteParticipant } from 'livekit-client';
import { api } from '~/trpc/react';
import { toast } from '~/lib/toast';

export interface TestMessage {
  type: 'test_message';
  fromBeingId: string;
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
        console.log('Connected to LiveKit room:', roomBeingId);
        setIsConnected(true);
        toast.success(`Connected to LiveKit room: ${roomBeingId}`);
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('Disconnected from LiveKit room');
        setIsConnected(false);
        toast.info('Disconnected from LiveKit room');
      });

      room.on(RoomEvent.DataReceived, (
        payload: Uint8Array,
        participant?: RemoteParticipant,
        kind?: DataPacket.Kind,
        topic?: string
      ) => {
        try {
          const text = new TextDecoder().decode(payload);
          
          if (topic === 'demo') {
            const message: TestMessage = JSON.parse(text);
            console.log('Received test message:', message);
            
            // Show toast notification for incoming messages
            toast.message(`LiveKit Message from ${message.fromBeingId}`, {
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
```

## Space Page Integration

The primary implementation connects users to LiveKit rooms automatically when visiting Being space pages.

**Core Space Page Hook - `src/hooks/useSpaceLiveKit.ts`:**

```typescript
'use client';

import { useEffect } from 'react';
import { useLiveKitDemo } from './useLiveKitDemo';

interface UseSpaceLiveKitProps {
  spaceBeingId: string;
  autoConnect?: boolean;
}

export function useSpaceLiveKit({ spaceBeingId, autoConnect = true }: UseSpaceLiveKitProps) {
  const livekit = useLiveKitDemo();

  useEffect(() => {
    if (autoConnect && spaceBeingId) {
      // Automatically connect when visiting space page
      livekit.connect(spaceBeingId);
    }

    return () => {
      // Cleanup on page leave
      livekit.disconnect();
    };
  }, [spaceBeingId, autoConnect, livekit]);

  return livekit;
}
```

**Integration in Space Page Component:**

```typescript
// In your space page component (e.g., src/app/beings/[beingId]/page.tsx)
'use client';

import { useSpaceLiveKit } from '~/hooks/useSpaceLiveKit';

export function SpacePage({ params }: { params: { beingId: string } }) {
  const spaceBeingId = `@${params.beingId}`;
  
  // Automatically connect to LiveKit room when visiting this space
  const { isConnected, sendMessage } = useSpaceLiveKit({ 
    spaceBeingId,
    autoConnect: true 
  });

  // Your existing space page content...
  return (
    <div>
      {/* Connection indicator */}
      {isConnected && (
        <div className="text-xs text-green-600">
          🟢 Live connected to {spaceBeingId}
        </div>
      )}
      
      {/* Your space content */}
      {/* ... */}
    </div>
  );
}
```

## Demo Test Button

For testing purposes, also add a simple test button to your site menu:

**Example test button in your site menu component:**

```typescript
'use client';

import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { useLiveKitDemo } from '~/hooks/useLiveKitDemo';

export function LiveKitTestButton() {
  const [testRoomId] = useState('@demo-space'); // Test space Being ID
  const { connect, disconnect, sendMessage, isConnected, isConnecting } = useLiveKitDemo();

  const handleToggleConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect(testRoomId);
    }
  };

  const handleSendTestMessage = () => {
    sendMessage(testRoomId, `Test message at ${new Date().toLocaleTimeString()}`);
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        onClick={handleToggleConnection}
        disabled={isConnecting}
        variant={isConnected ? "destructive" : "default"}
        size="sm"
      >
        {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect LiveKit' : 'Test LiveKit'}
      </Button>
      
      {isConnected && (
        <Button
          onClick={handleSendTestMessage}
          variant="outline"
          size="sm"
        >
          Send Test Message
        </Button>
      )}
    </div>
  );
}
```

## API Route Handler

**`src/app/api/trpc/[trpc]/route.ts`**

Ensure your tRPC handler uses Node.js runtime for LiveKit server SDK compatibility:

```typescript
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '~/server/api/root';
import { createTRPCContext } from '~/server/api/trpc';

export const runtime = 'nodejs'; // Required for LiveKit server SDK

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
```

## Installation Requirements

Install the LiveKit client SDK:

```bash
npm install livekit-client
```

The server SDK (`livekit-server-sdk`) is already installed according to your `package.json`.

## Key Architectural Decisions

1. **Page-to-Room Mapping**: When a user visits a Being space page at `/beings/@workspace`, they connect to LiveKit room `@workspace`. The room ID is always identical to the space Being ID.

2. **User Identity**: LiveKit participant identity uses the logged-in user's Being ID (`ctx.auth.beingId`), ensuring consistent identity across your system.

3. **Space Validation**: Only Beings of type "space" can be used as LiveKit rooms, enforced in the tRPC procedure.

4. **Authentication Integration**: LiveKit tokens are generated server-side using your existing NextAuth.js authentication and Being system.

5. **Data-Only Mode**: Starting with text chat only (no audio/video) to keep complexity manageable.

6. **Demo-Only Persistence**: Test messages don't persist to your database - they're purely for real-time testing.

## Implementation Summary

This integration provides:

1. **Automatic Space Connection**: Users visiting `/beings/@some-space` automatically connect to LiveKit room `@some-space`
2. **Being-Based Identity**: LiveKit participant identity uses `ctx.auth.beingId` (logged-in user's Being ID)
3. **Toast Notifications**: Real-time messages appear as toast notifications using your existing Sonner setup
4. **Demo Testing**: Manual test button for sending messages to verify real-time functionality

## Future Enhancements

1. **Permission System**: Add proper room access controls based on Being ownership/membership
2. **Message History**: Load existing Intentions when joining a room
3. **Presence Indicators**: Show who's currently connected to each room
4. **Audio/Video**: Expand beyond data-only when ready
5. **Bot Integration**: Connect your existing bot system to send messages via LiveKit

## Testing the Integration

Test both the core space page integration and demo functionality:

### Core Space Page Testing
1. **Create a test space**: Make sure you have a Being with ID like `@workspace` and type "space"
2. **Visit the space page**: Navigate to `/beings/workspace` (without the @ prefix in URL)
3. **Verify auto-connection**: Should see "🟢 Live connected to @workspace" indicator
4. **Multi-tab testing**: Open the same space page in multiple tabs - both should auto-connect
5. **Toast notifications**: Messages sent via the demo button should appear as toasts on all connected tabs

### Demo Button Testing  
1. **Create demo space**: Make sure you have a Being with ID `@demo-space` and type "space"
2. **Add test button**: Integrate `LiveKitTestButton` into your site menu/navigation  
3. **Manual testing**: Use the test button to send messages to `@demo-space`
4. **Cross-tab verification**: Messages should appear as toasts across all connected instances

## Key Simplifications

This simplified approach focuses on **demonstration and testing** rather than full chat functionality:

- **Toast-based feedback**: All LiveKit messages appear as toast notifications using your existing Sonner setup
- **Demo endpoints**: The `sendTestMessage` tRPC procedure is clearly marked as demo-only
- **Simple UI**: Just two buttons in your site menu instead of a full chat interface
- **No persistence**: Test messages don't persist to your database - purely for real-time testing

This gives you a clean way to test LiveKit integration without building complex UI, while keeping the door open for future chat/collaboration features built on the same foundation.