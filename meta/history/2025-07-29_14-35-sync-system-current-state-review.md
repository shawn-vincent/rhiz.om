# Sync System Current State Review

**Date:** 2025-07-29 14:35  
**Reviewer:** Orin  
**Focus:** Assessment of proposed sync system simplification implementation

## Architecture Verdict: DRIFTING

The sync system has been partially consolidated but **the proposed simplification has NOT been implemented**. The system remains architecturally complex with concerning patterns still present.

## Analysis Summary

### 1. Proposed vs. Actual Implementation

**Proposed (from design assessment):**
```typescript
// Replace complex useSync with focused hooks
const beings = useBeingsInLocation(spaceId);
const intentions = useIntentionsInLocation(spaceId);

// Single sync mechanism instead of mixed events
const sync = useLiveKitSync(spaceId);
```

**Current Reality:**
```typescript
// Single monolithic hook still exists
const { beings, intentions, isConnected, room } = useSync(spaceId);
// Internal complexity still high - singleton pattern, ref juggling
```

### 2. Current Architectural State

**What was accomplished:**
- **Unified transport:** Successfully migrated from SSE to LiveKit-only sync
- **Consolidated server-side:** `ServerSync` class provides clean broadcast interface
- **Eliminated dual systems:** No more mixed SSE/LiveKit transport

**What remains problematic:**
- **Monolithic client hook:** `useSync()` still combines data fetching + sync management
- **Singleton globals:** `let syncClient: LiveKitSync | null = null` breaks React patterns
- **Ref juggling:** Complex `useRef` dance to avoid dependency loops
- **Mixed concerns:** Single hook handles connection state, data fetching, and room management

## Boundary Violations

**File:Line violations:**

1. `/Users/svincent/projects/rhiz.om/src/hooks/use-sync.ts:6` - Global singleton in React context
2. `/Users/svincent/projects/rhiz.om/src/hooks/use-sync.ts:21-26` - Ref mutation to avoid React dependencies  
3. `/Users/svincent/projects/rhiz.om/src/hooks/use-sync.ts:12-15` - Data fetching mixed with sync management
4. `/Users/svincent/projects/rhiz.om/src/lib/sync.ts:10-25` - Node.js EventEmitter in isomorphic context

## Flow Leaks & Round-trips

**Critical flow:** Chat message creation → sync → UI update

1. **UI→ tRPC** (chat.tsx:50) - `createUtterance.mutate()`
2. **tRPC→ Operations** - `createIntention()` in being-operations.ts
3. **Operations→ DB** - Drizzle insert
4. **Operations→ Sync** - `serverSync.broadcast()` 
5. **Sync→ LiveKit** - `broadcastSyncEvent()` via room service
6. **LiveKit→ Client** - Data packet received by `LiveKitSync`
7. **Client→ React** - `refetchBeingsRef.current()` + `refetchIntentionsRef.current()`

**Issues:**
- **Redundant round-trip:** Why broadcast when we already have the data client-side?
- **Double fetch:** Client creates data, then refetches same data from server
- **Ping-pong pattern:** Write → Broadcast → Refetch instead of optimistic updates

## Surface Diet (delete/inline/rename)

### Delete:
- `/Users/svincent/projects/rhiz.om/src/hooks/use-sync.ts:6` - Global singleton `syncClient`
- `/Users/svincent/projects/rhiz.om/src/lib/sync.ts:10-25` - Server-side EventEmitter complexity
- `/Users/svincent/projects/rhiz.om/src/lib/sync/server-sync.ts` - Unnecessary wrapper around `broadcastSyncEvent`

### Inline:
- `ServerSync` class → direct `broadcastSyncEvent()` calls
- Complex ref management → simpler hook separation

### Rename:
- `useSync()` → `useLiveKitRoom()` + `useBeingsSync()` + `useIntentionsSync()`

## API Before → After Sketches

**Current (monolithic):**
```typescript
// Mixes data, connection, and sync concerns
const { beings, intentions, isConnected, room } = useSync(spaceId);
```

**Proposed (focused):**
```typescript
// Separate data fetching from sync transport
const beings = useBeingsInLocation(spaceId);
const intentions = useIntentionsInLocation(spaceId);
const { isConnected, room } = useLiveKitRoom(spaceId);

// Optional: sync-aware versions that handle optimistic updates
const syncedBeings = useBeingsSync(spaceId);
const syncedIntentions = useIntentionsSync(spaceId);
```

**Server-side:**
```typescript
// Before: Unnecessary abstraction
await serverSync.broadcast(event);

// After: Direct call
await broadcastSyncEvent(spaceId, event);
```

## Specific Architectural Issues

### 1. Singleton Pattern Anti-pattern
- **Issue:** Global `syncClient` breaks React component isolation
- **Impact:** Components can't have independent sync connections
- **Fix:** Move instance management into React context or per-hook state

### 2. Mixed Data/Sync Concerns
- **Issue:** `useSync()` combines tRPC queries with LiveKit room management
- **Impact:** Can't reuse data queries without sync, can't test sync without data
- **Fix:** Separate hooks with clear responsibilities

### 3. Ref Juggling Complexity
- **Issue:** Complex `useRef` pattern to avoid dependency cycles
- **Impact:** Fragile, hard to understand, breaks React patterns
- **Fix:** Proper hook separation eliminates need for ref workarounds

### 4. Unnecessary Server Abstraction
- **Issue:** `ServerSync` class wraps single `broadcastSyncEvent()` call
- **Impact:** Extra indirection with no benefit
- **Fix:** Remove class, call `broadcastSyncEvent()` directly

## Minimal PR Plan (2-4 reversible commits)

### Commit 1: Remove Server-side Abstraction
```diff
- import { ServerSync } from "~/lib/sync/server-sync";
- const serverSync = new ServerSync();
- await serverSync.broadcast(event);

+ import { broadcastSyncEvent } from "~/server/lib/livekit";
+ await broadcastSyncEvent(event.locationId, event);
```
**Files:** `/Users/svincent/projects/rhiz.om/src/lib/being-operations.ts`
**Delete:** `/Users/svincent/projects/rhiz.om/src/lib/sync/server-sync.ts`

### Commit 2: Separate Data from Sync Hooks
```typescript
// New focused hooks
export function useBeingsInLocation(spaceId: string) {
  return api.being.getByLocation.useQuery({ locationId: spaceId });
}

export function useIntentionsInLocation(spaceId: string) {
  return api.intention.getAllUtterancesInBeing.useQuery({ beingId: spaceId });
}

export function useLiveKitRoom(spaceId: string) {
  // Room connection + token management only
  // No data fetching
}
```

### Commit 3: Replace useSync Usage
```diff
- const { beings, intentions, isConnected } = useSync(spaceId);
+ const { data: beings } = useBeingsInLocation(spaceId);
+ const { data: intentions } = useIntentionsInLocation(spaceId);
+ const { isConnected } = useLiveKitRoom(spaceId);
```

### Commit 4: Remove Singleton Pattern
```typescript
// Replace global singleton with React context or hook-local state
export function useLiveKitRoom(spaceId: string) {
  const [client] = useState(() => new LiveKitSync());
  // Proper cleanup in useEffect
}
```

## Temporal Semantics Issues

### Missing Patterns:
- **Optimistic updates:** Client creates data, broadcasts, then refetches
- **Conflict resolution:** No handling of concurrent edits
- **Connection recovery:** Reconnection logic exists but not tested
- **Message ordering:** LiveKit handles this but application doesn't verify

### Recommended Additions:
- Optimistic updates with rollback on sync event conflicts
- Connection state management with exponential backoff
- Message deduplication based on timestamps

## Observability Gaps

### Missing:
- Sync event metrics (success/failure rates)
- Connection health monitoring  
- Message delivery confirmation
- Performance tracking for sync loops

### Present:
- Error logging in `handleDataReceived`
- Basic connection state tracking

## Performance Implications

### Current Issues:
- **Double fetch:** Client fetches data it just created
- **Broadcast spam:** Every operation broadcasts even to originator
- **No batching:** Individual sync events instead of batched updates

### Optimization Opportunities:
- Skip broadcast to originating client
- Batch sync events within time windows
- Use optimistic updates to eliminate refetch round-trips

## Migration Safety

**Forward-safe:** ✅ Proposed changes maintain API compatibility  
**Reversible:** ✅ Each commit is independently revertible  
**Zero-downtime:** ✅ Changes don't affect runtime behavior initially

## Conclusion

The sync system has been **consolidated but not simplified**. The proposed architectural simplification from the design assessment remains unimplemented. The system works but carries technical debt that will compound as features are added.

**Immediate actions needed:**
1. Remove unnecessary server-side abstractions (5-minute fix)
2. Separate data fetching from sync management (1-2 hour refactor)
3. Eliminate global singleton pattern (30-minute fix)
4. Add optimistic updates to reduce round-trips (future enhancement)

**Priority:** HIGH - Current complexity blocks clean feature development and testing.

---

*Review completed by Orin*  
*Hierarchy: Simplicity >> Elegance >> Normality >> Robustness >> Performance >> Security >> Functionality*