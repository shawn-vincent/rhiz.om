# Ultra-Minimal Sync System Proposal
**Date:** 2025-07-28  
**Author:** Orin + User Collaboration
**Status:** Proposal - Awaiting Review

## Problem Statement

The current sync system has two critical performance bottlenecks:
1. **Database overhead**: O(n) queries fetching all entities on every change
2. **Network overhead**: Broadcasting 50KB+ arrays to mobile clients on every change

## Core Design Principles

1. **Message reliability is non-negotiable** - missed messages are unacceptable
2. **Network efficiency for mobile** - minimize data transfer
3. **Architectural simplicity** - eliminate unnecessary abstractions
4. **Single event type** - reduce client complexity

## Proposed Solution: Timestamp-Based Delta Sync

### Single Event Type

```typescript
export type SyncEvent = {
  type: "space-delta";
  created: Intention[];    // New messages since last sync
  updated: Intention[];    // Edited messages (rare)
  deleted: string[];       // Deleted message IDs (rare)
  timestamp: string;       // ISO timestamp for next catch-up
};
```

### Connection Protocol

**Initial Connection:**
1. Client connects: `GET /api/stream?spaceId={id}&since={timestamp}`
2. Server responds with:
   - `space-delta` with recent messages (or all if no `since` param)
   - Current timestamp for future requests
3. Server also sends current beings via existing tRPC (no sync needed)

**Message Updates:**
1. Changes accumulate in server-side buffer (1-second window)
2. Server broadcasts single `space-delta` with batched changes
3. Clients apply delta and track latest timestamp

**Reconnection/Recovery:**
1. Client reconnects with `?since={lastTimestamp}`
2. Server queries: `SELECT * FROM intentions WHERE location_id = ? AND created_at > ?`
3. If >50 messages missed, client refetches entire space via tRPC

### Database Schema Changes

```sql
-- No schema changes needed - use existing created_at timestamps
-- Just add index for efficient timestamp queries
CREATE INDEX intentions_location_created_idx ON rhiz_om_intentions(location_id, created_at);
```

### Architecture Changes

**Server Side (Ultra-Simplified):**
- Remove all full-table scan functions
- Add `getIntentionsSince(spaceId, timestamp)` for catch-up
- Add 1-second batching buffer per space
- Remove all being sync (use existing tRPC)

**Client Side (Minimal Changes):**
- Add `lastTimestamp` tracking in `useSync`
- Handle single delta event type
- Remove all being sync (use existing tRPC cache)
- Keep existing message grouping logic (just apply deltas to it)

### Event Flow

**Happy Path:**
1. User types message → intention created at `2025-07-28T10:30:15Z`
2. Server batches for 1 second, then broadcasts:
   ```typescript
   {
     type: "space-delta",
     created: [intention],
     updated: [],
     deleted: [],
     timestamp: "2025-07-28T10:30:16Z"
   }
   ```
3. Clients apply delta: `intentions.push(...event.created)`

**Recovery Path:**
1. Client disconnects briefly
2. Client reconnects: `?since=2025-07-28T10:29:00Z`
3. Server queries messages since timestamp, sends delta
4. Client catches up, no messages lost

**Being Updates:**
1. User changes profile → existing tRPC mutation
2. tRPC invalidates cache → client refetches beings
3. No sync events needed (beings change rarely)

## Network Efficiency

**Current System:**
- Message sent → 50KB array to all clients

**Proposed System:**
- Message sent → 1KB delta to relevant clients (50x reduction)
- Multiple rapid messages → single batched delta (additional efficiency)
- Being updates → no sync traffic (use existing tRPC)

## Presence UI Changes

**Keep:** Avatar display showing beings in space (via tRPC cache)
**Remove:** All real-time presence sync
**Benefit:** Zero presence traffic, beings loaded once via tRPC

## Implementation Plan

**Phase 1: Server Delta Events (1 day)**
- Add `getIntentionsSince(spaceId, timestamp)` query
- Replace array broadcasts with single `space-delta` event
- Remove all being sync from stream system

**Phase 2: Client Delta Handling (1 day)**
- Replace array replacement with delta application
- Add timestamp tracking for reconnection
- Remove being sync from `useSync` (use existing tRPC)

**Phase 3: Cleanup (0.5 days)**
- Delete all full-scan functions
- Remove unused array processing code
- Remove presence event handling

## Code Reduction

**Current System:** ~289 lines
**Estimated New System:** ~180 lines (**38% reduction**)

**Major eliminations:**
- `getSpaceBeings()` and `getSpaceIntentions()` functions (~50 lines)
- All being sync logic (~40 lines)
- Array replacement event handling (~30 lines)
- Presence connection tracking (~20 lines)

**Additions:**
- `getIntentionsSince()` query (~15 lines)
- Delta batching logic (~20 lines)
- Timestamp tracking (~10 lines)

## Benefits

1. **50x network efficiency** for message traffic
2. **No database bottlenecks** (efficient timestamp queries)
3. **Message reliability** via timestamp-based catch-up
4. **Ultra-simple architecture** (single event type)
5. **Natural batching** (multiple rapid changes → single delta)
6. **38% code reduction** overall
7. **No new database schema** needed

## Architecture Boundaries

**Clean Separation:**
- **Sync Layer**: Only handles intention deltas via SSE
- **Entity Layer**: Beings managed via existing tRPC
- **No mixing**: Database queries stay in domain services

**Event Flow:**
- Intention changes → sync deltas
- Being changes → tRPC mutations/queries
- No cross-contamination between systems

## Risk Assessment

**Low Risk:**
- Timestamp queries (existing `created_at` field)
- Delta application (simpler than array replacement)
- No new database schema required

**Very Low Risk:**
- Single event type (less client complexity)
- Existing tRPC handles being updates (proven system)
- Natural batching reduces event frequency

## Questions for Review

1. Is 1-second batching window appropriate for chat responsiveness?
2. Should we have a maximum batch size (e.g., 10 messages per delta)?
3. Is 50-message catch-up limit reasonable before full reload?

## Conclusion

This ultra-minimal approach achieves all performance goals while maximizing architectural simplicity:

- **Network efficiency**: 50x reduction through deltas
- **Database efficiency**: Indexed timestamp queries instead of full scans
- **Code simplicity**: 38% reduction, single event type
- **Reliability**: Timestamp-based catch-up ensures no lost messages
- **Clean boundaries**: Sync handles intentions, tRPC handles beings

The solution eliminates all unnecessary complexity while maintaining the core benefits of real-time message delivery and mobile performance.