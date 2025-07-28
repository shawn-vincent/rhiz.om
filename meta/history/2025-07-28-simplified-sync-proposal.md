# Simplified Sync System Proposal
**Date:** 2025-07-28  
**Author:** Orin + User Collaboration
**Status:** Proposal - Awaiting Review

**Rejected, replaced with meta/history/2025-07-28-ultra-minimal-sync-proposal.md**

## Problem Statement

The current sync system has two critical performance bottlenecks:
1. **Database overhead**: O(n) queries fetching all entities on every change
2. **Network overhead**: Broadcasting 50KB+ arrays to mobile clients on every change

## Core Design Principles

1. **Message reliability is non-negotiable** - missed messages are unacceptable
2. **Network efficiency for mobile** - minimize data transfer
3. **Eliminate presence sync** - keep presence UI but no real-time online/offline events
4. **Architectural simplicity** - avoid complex versioning schemes

## Proposed Solution: Message-ID Based Sync

### Event Types

```typescript
export type SyncEvent =
  | { type: "intention-created"; data: Intention; messageId: string }
  | { type: "intention-updated"; data: Intention; messageId: string }
  | { type: "being-updated"; data: Being }  // Infrequent, can use full sync
  | { type: "space-sync"; beings: Being[]; lastMessageId: string }; // Initial/recovery
```

### Connection Protocol

**Initial Connection:**
1. Client connects: `GET /api/stream?spaceId={id}&since={lastMessageId}`
2. Server responds with `space-sync` event containing:
   - All current beings (for presence UI)
   - All messages since `lastMessageId` (or recent messages if no `since` param)
   - Current `lastMessageId` for future requests

**Message Updates:**
1. New intention created → server broadcasts `intention-created` with unique `messageId`
2. Intention updated (AI response streaming) → server broadcasts `intention-updated` with same `messageId`
3. Clients track latest `messageId` received

**Being Updates (Rare):**
1. Being profile changes → server broadcasts `being-updated` (no messageId needed)
2. Being creation/deletion → triggers `space-sync` for affected clients

**Reconnection/Recovery:**
1. Client reconnects with `?since={lastMessageId}`
2. Server sends all missed `intention-*` events since that ID
3. If gap too large (>100 messages), server sends `space-sync` instead

### Database Schema Changes

```sql
-- Add to intentions table only (beings don't need message IDs)
ALTER TABLE rhiz_om_intentions ADD COLUMN message_id VARCHAR(255) UNIQUE;
CREATE INDEX intentions_message_id_idx ON rhiz_om_intentions(message_id);
CREATE INDEX intentions_location_created_idx ON rhiz_om_intentions(location_id, created_at);

-- Message ID sequence per space (simple UUID or increment)
```

### Architecture Changes

**Server Side (Simplified):**
- Remove `getSpaceBeings()` and `getSpaceIntentions()` full-table scans
- Add in-memory being cache per space
- Add message ID generation (UUID or per-space counter)
- Add `getMessagesSince(spaceId, messageId)` for catch-up

**Client Side (Minimal Changes):**
- Add `lastMessageId` tracking in `useSync`
- Handle individual intention events instead of array replacement
- Keep existing being array (updated infrequently)
- Add connection recovery with `?since` parameter

### Event Flow

**Happy Path:**
1. User types message → intention created with `messageId: "msg_123"`
2. Server broadcasts: `{ type: "intention-created", data: intention, messageId: "msg_123" }`
3. All clients add intention to local state, track `lastMessageId = "msg_123"`

**Recovery Path:**
1. Client disconnects briefly
2. Client reconnects: `?since=msg_120`  
3. Server sends: `intention-created` for msg_121, msg_122, msg_123
4. Client catches up, no messages lost

**Being Updates:**
1. User changes profile → being updated
2. Server broadcasts: `{ type: "being-updated", data: being }`
3. Clients update being in local cache (no message ID needed)

## Network Efficiency

**Current System:**
- Message sent → 50KB array to all clients
- Profile update → 50KB array to all clients

**Proposed System:**
- Message sent → 1KB event to relevant clients (50x reduction)
- Profile update → 500 bytes event to relevant clients (100x reduction)
- Initial connection → 10-50KB depending on history (same as current)

## Presence UI Changes

**Keep:** Avatar display showing beings in space
**Remove:** Online/offline indicators and real-time presence events
**Benefit:** Eliminates ~50% of real-time traffic (connect/disconnect spam)

The presence UI will show "who belongs to this space" rather than "who is currently online." Future plans for this UI control remain unchanged.

## Implementation Plan

**Phase 1: Database + Message IDs**
- Add `message_id` column to intentions table
- Generate unique message IDs on intention creation
- Add `getMessagesSince()` query function

**Phase 2: Server Event Changes**
- Replace full array broadcasts with individual events
- Add in-memory being cache per space
- Implement `?since` parameter in stream endpoint

**Phase 3: Client Updates**
- Add `lastMessageId` tracking to `useSync`
- Handle individual intention events
- Add connection recovery logic

**Phase 4: Remove Array Processing**
- Delete `getSpaceBeings()` and `getSpaceIntentions()` functions
- Remove full array broadcast logic
- Clean up unused array processing code

## Code Reduction

**Current System:** ~289 lines
**Estimated New System:** ~220 lines (**25% reduction**)

**Major eliminations:**
- Full-table scan functions (~40 lines)
- Complex array diffing in React (~30 lines)
- Presence event handling (~20 lines)

**Additions:**
- Message ID tracking (~15 lines)
- Catch-up query logic (~20 lines)

## Risk Assessment

**Low Risk:**
- Message ID generation (simple UUID)
- Individual event handling (simpler than arrays)
- Backward-compatible during migration

**Medium Risk:**
- Catch-up logic correctness (need thorough testing)
- Message ordering guarantees during recovery
- Client-side connection recovery robustness

## Benefits

1. **50x network efficiency** for typical message traffic
2. **Eliminated database bottlenecks** (no more O(n) queries)
3. **Message reliability** via catch-up mechanism
4. **Simplified architecture** (no complex versioning)
5. **Mobile-friendly** (minimal battery/data usage)
6. **25% code reduction** overall

## Questions for Review

1. Should message IDs be UUIDs or per-space incrementing counters?
2. What's the reasonable catch-up limit before triggering full sync?
3. Should being updates also use message IDs for consistency?
4. How should we handle intention deletions (do they need message IDs)?

## Conclusion

This proposal achieves the core performance goals (network + database efficiency) while maintaining message reliability and architectural simplicity. By eliminating presence sync and focusing on message-ID-based catch-up, we avoid the complexity of global versioning while ensuring no messages are lost.

The approach balances the mobile performance requirements with implementation simplicity, providing a clear migration path that reduces overall code complexity.