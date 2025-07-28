# Sync System Performance Optimization Proposal
**Date:** 2025-07-28  
**Author:** Orin (Claude Code)  
**Status:** Proposal - Awaiting Review

**Rejected, replaced with meta/history/2025-07-28-ultra-minimal-sync-proposal.md**


## Current State Analysis

### Architecture Overview
The current sync system uses Server-Sent Events (SSE) with a simple, full-state broadcast model:

**Client Side (`src/lib/stream.ts`, `src/hooks/use-stream.ts`):**
- EventSource connections to `/api/stream?spaceId={id}`
- Shared connections per spaceId with subscriber tracking
- Simple state management: `beings[]` and `intentions[]` arrays
- Connection pooling to avoid duplicate EventSource instances

**Server Side (`src/server/lib/stream.ts`, `src/app/api/stream/route.ts`):**
- SSE endpoint accepting spaceId parameter
- Connection management with ReadableStream controllers
- Initial data load: sends ALL beings and intentions for the space
- Event handlers that re-fetch and broadcast ALL entities on any change

### Current Event Flow
1. **Connection**: Client connects → Server sends all beings + all intentions
2. **Being Update**: Any being changes → Server re-fetches ALL space beings → Broadcasts to all clients
3. **Intention Created**: New intention → Server re-fetches ALL space intentions → Broadcasts to all clients

### Performance Issues
1. **O(n) data transfer**: Every change sends complete datasets
2. **O(n) database queries**: Each event triggers full table scans with `locationId = spaceId`
3. **O(n) serialization**: Full superjson serialization of all entities per event
4. **O(n) network overhead**: Complete state transmitted for single-entity changes
5. **Client processing**: Must diff entire arrays to identify actual changes

### Code Size
- Client: ~114 lines across stream.ts + use-stream.ts
- Server: ~175 lines across stream.ts + route.ts
- **Total: ~289 lines**

## Proposed Delta-Based Solution

### Core Changes

1. **Add version tracking to database schema**:
   ```sql
   -- Add to beings table
   ALTER TABLE rhiz_om_beings ADD COLUMN version BIGINT DEFAULT 1;
   
   -- Add to intentions table  
   ALTER TABLE rhiz_om_intentions ADD COLUMN version BIGINT DEFAULT 1;
   
   -- Add sequence for monotonic versions
   CREATE SEQUENCE rhiz_om_sync_version_seq;
   ```

2. **Modify event types to include individual entities**:
   ```typescript
   export type SyncEvent =
     | { type: "being-upsert"; data: Being; version: number }
     | { type: "being-delete"; id: string; version: number }
     | { type: "intention-upsert"; data: Intention; version: number }
     | { type: "intention-delete"; id: string; version: number }
     | { type: "sync-reset"; version: number }; // For missed versions
   
   // Note: "delete" events represent removal from the current space:
   // - True entity deletion from database
   // - Entity migration to different space (locationId change)
   // Client treats both cases identically: remove from local cache
   ```

3. **Client version tracking**:
   ```typescript
   // Track last known version per space
   const spaceVersions = new Map<string, number>();
   ```

### Event Flow Changes

**Connection Handshake:**
1. Client connects with `?spaceId={id}&lastVersion={n}` 
2. Server determines latest version for space
3. **Case 1 - Client is current**: `lastVersion == latestVersion`
   - Server sends only current connections (no data)
   - Normal delta sync begins
4. **Case 2 - Client is behind**: `lastVersion < latestVersion`
   - Server immediately sends individual `being-upsert` events for ALL current beings
   - Server immediately sends individual `intention-upsert` events for ALL current intentions  
   - Each event includes the entity's current version
   - Client rebuilds complete state from individual upserts
   - Normal delta sync begins

**Entity Updates (Normal Operation):**
1. Database update/delete increments version using sequence
2. Server broadcasts single `being-upsert`, `being-delete`, `intention-upsert`, or `intention-delete` event
3. Clients apply individual updates/deletions and track latest version

**Note on Delete Events:**
- `being-delete` / `intention-delete` represent **removal from current space**
- Triggers for delete events:
  - True database deletion (entity permanently removed)
  - Location migration (entity moved to different space via `locationId` change)
- Client behavior is identical: remove entity from local space cache
- Entity may still exist in database and appear in other spaces

**Version Gap Detection:**
1. Client receives event with `version > lastKnownVersion + 1`
2. **Client action**: Immediately reconnects with current `lastVersion`
3. **Server response**: Treats as "Case 2" above - sends all current entities as individual upserts
4. Client rebuilds state and resumes normal operation

### Implementation Changes

**Database Schema** (~5 lines):
```sql
ALTER TABLE rhiz_om_beings ADD COLUMN version BIGINT DEFAULT nextval('rhiz_om_sync_version_seq');
ALTER TABLE rhiz_om_intentions ADD COLUMN version BIGINT DEFAULT nextval('rhiz_om_sync_version_seq');
CREATE INDEX beings_version_idx ON rhiz_om_beings(version);
CREATE INDEX intentions_version_idx ON rhiz_om_intentions(version);
```

**Server Changes** (~50 lines):
- Modify event handlers to send single entities instead of arrays
- Add version parameter to connection endpoint
- Add logic to send deltas based on client version
- Update `notifyBeingUpdate` and `notifyIntentionCreated` to include version

**Client Changes** (~30 lines):
- Add version tracking to connection state
- Modify event handlers to apply individual updates
- Add version parameter to connection requests
- Handle sync-reset events

### Performance Benefits

1. **O(1) data transfer**: Only changed entities transmitted
2. **O(1) database queries**: Single entity lookups instead of full table scans  
3. **O(1) serialization**: Individual entities vs. complete arrays
4. **Reduced network usage**: Minimal payloads for typical changes
5. **Faster client updates**: Direct entity updates vs. array diffing

### Complete Rewrite

This is a complete rewrite of the sync system and all consumer code:
- All event types change from arrays to individual entity operations
- All client components rewritten to handle incremental updates
- All server handlers rewritten to send deltas instead of full state
- Connection protocol requires version parameter
- No fallback to old full-array broadcasts

### Error Handling

- **Version gaps**: Client detects missed versions, reconnects to trigger individual upsert sequence
- **Connection drops**: Client reconnects with last known version, server sends catch-up upserts
- **Database failures**: Connection fails (no fallback behavior)
- **Invalid versions**: Server treats any invalid/missing version as "behind" and sends all entities

## Implementation Estimate

**Total Code Changes:**
- Database migration: ~5 lines
- Server modifications: ~50 lines  
- Client modifications: ~30 lines
- **Net change: +85 lines** (vs current 289 lines)

**New total: ~374 lines** (29% increase, but eliminates all array-based sync complexity)

The delta-only approach removes the need for array diffing and full-state management, potentially achieving fewer total lines than estimated.

## Rollout Strategy

1. **Phase 1**: Add database schema with version columns + deletion event support
2. **Phase 2**: Rewrite core sync system (server-side delta broadcasts)
3. **Phase 3**: Rewrite all consumer components for incremental updates
4. **Phase 4**: Deploy complete new system (breaking change)
5. **Phase 5**: Monitor performance and iterate

## Downstream Impact Analysis

### **Current State Management Architecture**

The existing system relies heavily on array-based state management with complex downstream dependencies:

**Core Pattern:**
```typescript
const { beings, intentions } = useSync(spaceId);
// Components derive state from complete arrays
const groupedMessages = useMemo(() => {
  // Complex array iteration and grouping
}, [intentions]);
```

### **Comprehensive Dependency Analysis**

**5 Direct useSync() Consumers:**
- `src/app/_components/chat.tsx` (high complexity - message grouping)
- `src/app/_components/being-presence.tsx` (high complexity - presence sorting)
- `src/app/_components/config.tsx` (medium complexity - entity ordering)
- `src/components/inline-being-name.tsx` (low complexity - entity lookup)
- `src/hooks/use-beings.tsx` (high complexity - cache management)

**Critical Array Dependencies:**
1. **Chat Component (`chat.tsx:92, 149, 195, 240`)**:
   - `groupedMessages` useMemo depends on entire `utterances` array
   - Consecutive message grouping requires full array iteration
   - Render loops: `groupedMessages.map()` → `group.messages.map()`
   - Auto-scroll effect triggered by array changes

2. **Being Presence (`being-presence.tsx:89, 222, 276`)**:
   - Complex filtering: `spacesAndBots`, `connectedGuests`, `disconnectedGuests`
   - `orderedBeings` concatenation and sorting
   - Permission map generation from full beings array
   - Multiple render loops in compact/full modes

3. **Being Cache System (`use-beings.tsx:60, 145`)**:
   - Map creation from arrays: `streamBeings` → `beingMap`
   - Cache overlaying: global beings + stream beings
   - Array-to-Map transformations and `getAllBeings()` conversions

### **Simplifications Enabled**

**1. Server-Side Eliminations**
```typescript
// REMOVE: These expensive functions
async function getSpaceBeings(spaceId: string): Promise<Being[]>
async function getSpaceIntentions(spaceId: string): Promise<Intention[]>

// REMOVE: Full array broadcasts  
broadcast({ type: "beings", data: spaceBeings }, { spaceId });
broadcast({ type: "intentions", data: spaceIntentions }, { spaceId });

// REPLACE WITH: Single entity events
broadcast({ type: "being-upsert", data: being, version }, { spaceId });
broadcast({ type: "being-delete", id: beingId, version }, { spaceId });
```

**2. Client-Side Simplifications**

**Chat Component:** 
```typescript
// CURRENT: Expensive grouping on every change
const groupedMessages = useMemo(() => {
  const groups = [];
  for (const utterance of utterances) { /* complex logic */ }
  return groups;
}, [utterances]); // Runs on ANY intention change

// SIMPLIFIED: Maintain groups as Map, update incrementally
const messageGroups = useMessageGroups(spaceId);
// Groups updated only when specific messages change
```

**Being Cache:**
```typescript
// REMOVE: Array-to-Map conversions throughout
const beingMap = useMemo(() => {
  const map = new Map();
  for (const being of streamBeings) { map.set(being.id, being); }
  return map;
}, [streamBeings]);

// SIMPLIFIED: Direct Map storage, no conversion needed
const beings = useEntityStore(spaceId); // Already a Map
```

**3. New Event Handling**

```typescript
// Handle all entity operations incrementally
const handleSyncEvent = (event: SyncEvent) => {
  switch (event.type) {
    case "being-upsert":
      entityStore.set(event.data.id, event.data);
      break;
    case "being-delete":
      // Remove from current space (true deletion OR migration to other space)
      entityStore.delete(event.id);
      break;
    case "intention-upsert":
      entityStore.set(event.data.id, event.data);
      updateMessageGroups(event.data); // Incremental
      break;
    case "intention-delete":
      // Remove from current space (true deletion OR migration to other space)
      entityStore.delete(event.id);
      removeFromMessageGroups(event.id); // Incremental
      break;
  }
};
```

**4. Eliminated Array Processing**

- **No more:** `beings.find()`, `beings.filter()`, `beings.map()` on every change
- **No more:** React diffing entire arrays for minimal changes  
- **No more:** useMemo dependencies on large arrays
- **No more:** Complex state derivation from complete datasets

### **Complete Rewrite Assessment**

**All Files Require Rewriting:**

**Core Sync System (2-3 days):**
1. **`src/lib/stream.ts`**: Complete rewrite for entity-based events
2. **`src/hooks/use-stream.ts`**: Rewrite for Map-based entity store
3. **`src/server/lib/stream.ts`**: Rewrite for delta broadcasts
4. **`src/app/api/stream/route.ts`**: Add version parameter handling

**Consumer Components (1-2 days each):**
5. **`chat.tsx`**: Rewrite for incremental message group updates + deletion handling
6. **`being-presence.tsx`**: Rewrite for incremental presence updates + deletion handling
7. **`use-beings.tsx`**: Rewrite for direct Map operations + deletion handling
8. **`config.tsx`**: Rewrite for entity subscriptions + deletion handling
9. **`inline-being-name.tsx`**: Rewrite for entity subscriptions + deletion handling

**Database & Server (1 day):**
10. **Database schema**: Add version columns and deletion event support
11. **Entity services**: Add deletion event emission

### **Simplified Architecture**

**Key Insight:** Current array-based approach FORCES complexity. Delta updates should eliminate this overhead entirely.

**New Entity Store Pattern:**
```typescript
// Current: Expensive array processing
const { beings, intentions } = useSync(spaceId);
const groupedMessages = useMemo(() => {
  // Complex iteration over entire array
  for (const utterance of utterances) { /* ... */ }
}, [utterances]); // Re-runs on ANY change

// Simplified: Direct entity updates
const entityStore = useEntityStore(spaceId);
// Chat groups maintained as Map, single updates only
```

**What Gets ELIMINATED:**
- Server: `getSpaceBeings()` + `getSpaceIntentions()` functions (~35 lines)
- Server: Full array broadcast logic (~25 lines)
- Client: Array-to-Map conversions in multiple components (~30 lines)
- Client: Expensive `.filter()`, `.map()` operations on every change (~40 lines)
- Client: Complex useMemo dependencies on full arrays (~20 lines)

**What Gets SIMPLIFIED:**
- Chat grouping: Map updates instead of full array iteration
- Presence filtering: Single entity status updates
- Cache management: Direct Map operations, no array conversion
- Entity lookups: O(1) Map access instead of O(n) array.find()

### **Code Volume Impact**

**Current System:** ~289 lines
**Estimated New System:** ~180-200 lines (30-40% DECREASE)

**Major simplifications:**
- Eliminate full array processing throughout the stack
- Remove expensive React array diffing
- Replace complex state derivation with simple Map updates

### **Risk Assessment**

**Low Risk Areas (Simplifications):**
- Entity lookups: `.find()` → `.get()` (simpler)
- Cache management: No array conversions needed
- State updates: Individual entities instead of full arrays

**Medium Risk Areas:**
- Testing coverage for incremental updates vs full state
- Version gap detection and recovery logic
- Migration timing for breaking changes

## Questions for Review

1. ~~Should we include entity deletion events?~~ **RESOLVED: Yes, deletion events included**
2. Should version be global sequence or per-space counter?
3. Should we implement soft deletes in database or handle hard deletes in sync?
4. Timeline for complete rewrite - all at once or phased component migration?
5. Should migration events (locationId changes) use separate event types or reuse delete/upsert pattern?

## Recovery Mechanism Summary

**Both recovery cases use the same pattern:**
- Server sends individual `being-upsert` and `intention-upsert` events (not arrays)
- Client processes each upsert to rebuild complete state
- This maintains the delta-based event structure while achieving full sync
- Network overhead is the same as current full-sync, but maintains consistent event types
- Client code handles both incremental and recovery updates identically

## Conclusion

**This is a significant architectural change, not a simple optimization.** The downstream impact analysis reveals that the current array-based state management is deeply embedded throughout the application.

**Expected Benefits:**
- O(1) performance for individual entity updates
- Eliminated array diffing and unnecessary re-renders
- Reduced network traffic and database load
- Better scalability for large spaces

**Expected Costs:**
- 2-3 weeks development time for complete rewrite
- All consumer components require rewriting for incremental updates
- New event handling patterns throughout the application
- Comprehensive testing for correctness of incremental updates and deletions

**Recommendation:** This is a complete architectural rewrite that fundamentally changes how the application handles real-time data. While it significantly improves performance and reduces complexity in the long term, it requires rewriting all sync-dependent code. The benefits (O(1) updates, eliminated array processing, better scalability) justify the complete rewrite effort.