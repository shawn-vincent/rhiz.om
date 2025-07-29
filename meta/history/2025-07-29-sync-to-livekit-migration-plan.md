# Sync System Replacement: SSE to LiveKit Real-time Data Channels

*Date: July 29, 2025*  
*Author: Claude Code & Shawn Vincent*  
*Purpose: Complete replacement of Server-Sent Events with LiveKit data channels*

## Executive Summary

This document outlines the complete replacement of rhiz.om's Server-Sent Events (SSE) synchronization system with LiveKit data channels. We will eliminate the SSE infrastructure entirely and use LiveKit exclusively for real-time sync data, removing the demo chat functionality.

## Current State Analysis

### Existing SSE Sync System

**Architecture Overview:**
- **Client-side**: `src/lib/stream.ts` - EventSource-based connection management
- **Server-side**: `src/server/lib/stream.ts` - ReadableStream-based SSE broadcasting
- **API endpoint**: `src/app/api/stream/route.ts` - SSE endpoint with auth and catch-up
- **React integration**: `src/hooks/use-stream.ts` - React hook for real-time data
- **Event system**: Node.js EventEmitter for internal notifications

**Current Data Flow:**
1. **Connection**: Client opens EventSource to `/api/stream?spaceId=@space`
2. **Authentication**: Server validates session and registers connection
3. **Catch-up**: Server sends recent data since last timestamp
4. **Real-time updates**: Server buffers and broadcasts deltas via SSE
5. **Client processing**: React hook applies deltas to local state

**SSE System Capabilities:**
- ✅ Real-time Being and Intention synchronization
- ✅ Timestamp-based catch-up for missed data
- ✅ Delta batching (1-second windows) for efficiency
- ✅ Connection pooling per space (shared EventSource instances)
- ✅ Automatic reconnection handling
- ✅ Structured logging with connection tracking

### Existing LiveKit System

**Current Usage:**
- **Demo chat functionality**: Test messaging between participants
- **tRPC procedures**: Token generation and test message sending
- **Auto-connection**: Space-specific providers for each Being space

**LiveKit Infrastructure Available:**
- ✅ WebRTC-based real-time connections  
- ✅ Reliable data packet transmission
- ✅ Topic-based message routing
- ✅ Room-based isolation (spaces)
- ✅ Server-side broadcasting capabilities

## Replacement Benefits

1. **Single Purpose System**: LiveKit handles only sync data (no chat demos)
2. **Simplified Architecture**: Eliminate SSE infrastructure completely  
3. **Better Reliability**: WebRTC's built-in reconnection and error recovery
4. **Clean Foundation**: Pure sync system ready for future expansion

## Implementation Plan

### Step 1: Add Sync to LiveKit Service

**File: `src/server/lib/livekit.ts`**

Add sync broadcasting function:

```typescript
export async function broadcastSyncEvent(spaceId: string, syncEvent: SyncEvent) {
  const payload = new TextEncoder().encode(superjson.stringify(syncEvent));
  
  await roomService.sendData(spaceId, payload, DataPacket_Kind.RELIABLE, {
    topic: 'sync',
  });
  
  return { success: true };
}
```

### Step 2: Direct Domain Notifications

**Remove:** `src/server/lib/stream.ts` entirely

**Update:** Domain services call LiveKit directly

**File: `src/domain/intention-service.ts`**

```typescript
// Replace import
- import { notifyIntentionCreated } from "~/server/lib/stream";
+ import { broadcastSyncEvent } from "~/server/lib/livekit";

// Replace notification call
- notifyIntentionCreated(intention.id, intention.locationId);
+ broadcastSyncEvent(intention.locationId, {
+   type: 'intention-created',
+   data: intention,
+   timestamp: new Date().toISOString()
+ });
```

### Step 3: Simplify LiveKit to Sync-Only

**File: `src/hooks/useLiveKitDemo.ts`** → **`src/hooks/useLiveKitSync.ts`**

Remove demo chat, keep only sync:

```typescript
// Remove all demo/chat functionality
// Keep only sync event handling:
room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
  if (topic === 'sync') {
    const syncEvent = superjson.parse(new TextDecoder().decode(payload));
    window.dispatchEvent(new CustomEvent('sync-change', { detail: syncEvent }));
  }
});
```

**File: `src/hooks/use-sync.ts`** (replace use-stream.ts)

```typescript
import { useEffect } from "react";
import { api } from "~/trpc/react";

export function useSync(spaceId: string) {
  // Get initial data and refetch capability
  const { data, refetch } = api.being.getBeingContents.useQuery({ beingId: spaceId });

  // Listen for sync events and refetch
  useEffect(() => {
    const handleSync = () => refetch();
    window.addEventListener('sync-change', handleSync);
    return () => window.removeEventListener('sync-change', handleSync);
  }, [refetch]);

  return { 
    beings: data?.beings || [], 
    intentions: data?.intentions || [],
    isConnected: true
  };
}
```

### Step 4: Clean Up

**Update these files:**
- `src/server/lib/bots.ts` - Change import to use `broadcastSyncEvent` directly

**Delete these files (500+ lines → 0):**
- `src/lib/stream.ts`
- `src/server/lib/stream.ts` 
- `src/app/api/stream/route.ts`
- `src/hooks/use-stream.ts`

**Remove demo functionality:**
- `src/components/livekit-test-button.tsx` - Delete test messaging UI
- `src/server/api/routers/livekit.ts` - Remove `sendTestMessage` procedure
- `src/app/_components/site-menu.tsx` - Remove LiveKit test section

## Implementation (25 lines total)

1. **Add `broadcastSyncEvent()` to LiveKit service** (10 lines)
2. **Update domain services to call LiveKit directly** (2 line changes)  
3. **Simplify LiveKit hook to sync-only** (5 lines)
4. **Replace use-stream.ts with simple use-sync.ts** (8 lines)
5. **Delete SSE infrastructure + demo chat** (600+ lines removed)

## Result

- Pure sync-only LiveKit system (no demo chat functionality)
- Eliminated SSE infrastructure completely
- Clean, focused real-time architecture  
- Ready for future expansion when needed

---

*"Simplicity is the ultimate sophistication."* - Leonardo da Vinci