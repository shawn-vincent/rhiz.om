# Sync System Simplification Implementation Plan

**Date:** July 29, 2025  
**Status:** READY TO IMPLEMENT  
**Estimated Effort:** 4 commits, ~6-8 hours  
**Risk Level:** LOW (reversible changes, API compatibility maintained)

## Executive Summary

The current sync system suffers from architectural drift that creates complexity, boundary violations, and maintenance burden. This plan provides a detailed roadmap to implement the "Commit 1: Sync System Simplification" from the design assessment, transforming the monolithic `useSync` hook into focused, composable hooks while eliminating singleton patterns and unnecessary abstractions.

**Current State:** DRIFTING - Complex, mixed concerns, ref juggling  
**Target State:** CLEAN - Focused hooks, clear boundaries, optimistic updates

## Problem Analysis

### Current Architecture Issues

#### 1. Monolithic Hook (`useSync`)
**Problem:** Single hook mixing multiple concerns
```typescript
// Current: Everything in one hook
const { beings, intentions, isConnected, room } = useSync(spaceId);
```

**Issues:**
- Data fetching + connection management + sync coordination
- Complex dependency management requiring refs
- Single point of failure
- Hard to test individual concerns

#### 2. Singleton Anti-Pattern
**Problem:** Global `syncClient` variable breaks React patterns
```typescript
// Current: Global singleton
let syncClient: LiveKitSync | null = null;
```

**Issues:**
- Breaks React's component isolation
- Memory leaks between space switches
- Race conditions during simultaneous connections
- Violates React's architectural principles

#### 3. Ref Juggling Complexity
**Problem:** Complex workarounds to avoid dependency cycles
```typescript
// Current: Unnecessary complexity
const refetchBeingsRef = useRef(refetchBeings);
const refetchIntentionsRef = useRef(refetchIntentions);
refetchBeingsRef.current = refetchBeings;
refetchIntentionsRef.current = refetchIntentions;
```

**Issues:**
- Symptoms of architectural problems, not solutions
- Makes code harder to understand and maintain
- Indicates dependency cycle that should be eliminated

#### 4. Unnecessary Abstractions
**Problem:** `ServerSync` class wraps single function call
```typescript
// Current: Unnecessary wrapper
export class ServerSync implements SyncServer {
    async broadcast(event: SyncEvent): Promise<void> {
        await broadcastSyncEvent(event.locationId, event);
    }
}
```

**Issues:**
- Adds complexity without value
- Creates extra indirection
- Violates YAGNI principle

#### 5. Inefficient Data Flow
**Problem:** Write → Broadcast → Refetch cycle
```typescript
// Current: Inefficient round-trip
1. User creates intention
2. Server broadcasts sync event  
3. Client refetches same data it just created
```

**Issues:**
- Unnecessary network requests
- Slower user experience
- Missed opportunity for optimistic updates

### Boundary Violations

#### Data Layer Violations
- `useSync` directly calls tRPC instead of using domain services
- Components directly access sync infrastructure
- Mixed transport and business logic

#### Component Layer Violations  
- UI components managing LiveKit room state
- Business logic scattered across presentation layer
- No clear separation of concerns

## Proposed Architecture

### Target Design Principles
1. **Single Responsibility:** Each hook has one clear purpose
2. **Composability:** Hooks can be used independently or together
3. **Testability:** Each concern can be tested in isolation
4. **Performance:** Optimistic updates reduce network round-trips
5. **React Patterns:** Proper component isolation, no singletons

### New Hook Structure

#### 1. Data Hooks (Domain Layer)
```typescript
// Focused data fetching with caching
function useBeingsInLocation(locationId: string): Being[] {
    const { data } = api.being.getByLocation.useQuery({ locationId });
    return data || [];
}

function useIntentionsInLocation(locationId: string): Intention[] {
    const { data } = api.intention.getAllUtterancesInBeing.useQuery({ 
        beingId: locationId 
    });
    return data || [];
}
```

#### 2. Connection Hook (Infrastructure Layer)
```typescript
// Pure connection management
function useLiveKitConnection(locationId: string): {
    room: Room | null;
    isConnected: boolean;
    connectionState: ConnectionState;
} {
    // No singleton - each component gets its own connection logic
    // Proper cleanup and lifecycle management
}
```

#### 3. Sync Coordination Hook (Application Layer)
```typescript
// Coordinates sync events with data invalidation
function useLiveKitSync(locationId: string): void {
    const queryClient = useQueryClient();
    const connection = useLiveKitConnection(locationId);
    
    // Listen for sync events and invalidate specific queries
    // No refetch refs - direct query invalidation
}
```

#### 4. Optimistic Updates (Performance Layer)
```typescript
// Enable optimistic updates for better UX
function useOptimisticIntentions(locationId: string): {
    intentions: Intention[];
    addOptimistic: (intention: Partial<Intention>) => void;
} {
    // Immediately show user's actions before server confirmation
}
```

## Implementation Plan

### Commit 1: Create Focused Data Hooks
**Scope:** Replace data fetching in `useSync`
**Files Changed:** 3-4 files
**Risk:** LOW (pure addition, no breaking changes)

#### Changes:
1. **Create `src/hooks/use-beings-in-location.ts`**
```typescript
export function useBeingsInLocation(locationId: string): Being[] {
    const { data, error } = api.being.getByLocation.useQuery(
        { locationId },
        { enabled: !!locationId }
    );
    
    if (error) {
        console.error('Failed to fetch beings:', error);
    }
    
    return data || [];
}
```

2. **Create `src/hooks/use-intentions-in-location.ts`**
```typescript
export function useIntentionsInLocation(locationId: string): Intention[] {
    const { data, error } = api.intention.getAllUtterancesInBeing.useQuery(
        { beingId: locationId },
        { enabled: !!locationId }
    );
    
    if (error) {
        console.error('Failed to fetch intentions:', error);
    }
    
    return data || [];
}
```

3. **Update `src/hooks/use-sync.ts`** (backward compatibility)
```typescript
export function useSync(spaceId: string) {
    const beings = useBeingsInLocation(spaceId);
    const intentions = useIntentionsInLocation(spaceId);
    // ... rest of current logic unchanged
    
    return { beings, intentions, isConnected, room };
}
```

#### Testing:
- Verify existing components still work
- Test individual hook behavior
- Ensure no performance regressions

### Commit 2: Eliminate Singleton Pattern
**Scope:** Remove global `syncClient` variable
**Files Changed:** 2-3 files
**Risk:** MEDIUM (connection behavior changes)

#### Changes:
1. **Create `src/hooks/use-livekit-connection.ts`**
```typescript
export function useLiveKitConnection(locationId: string) {
    const [room, setRoom] = useState<Room | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const getJoinToken = api.livekit.getJoinToken.useMutation();
    
    useEffect(() => {
        if (!locationId) return;
        
        let currentRoom: Room | null = null;
        
        const connect = async () => {
            try {
                const { token, wsUrl } = await getJoinToken.mutateAsync({ 
                    roomBeingId: locationId 
                });
                
                currentRoom = new Room();
                setRoom(currentRoom);
                setConnectionState('connecting');
                
                await currentRoom.connect(wsUrl, token);
                setConnectionState('connected');
            } catch (error) {
                setConnectionState('failed');
                console.error('Connection failed:', error);
            }
        };
        
        connect();
        
        return () => {
            if (currentRoom) {
                currentRoom.disconnect();
                setRoom(null);
                setConnectionState('disconnected');
            }
        };
    }, [locationId]);
    
    return {
        room,
        isConnected: connectionState === 'connected',
        connectionState
    };
}
```

2. **Update `src/hooks/use-sync.ts`**
```typescript
export function useSync(spaceId: string) {
    const beings = useBeingsInLocation(spaceId);
    const intentions = useIntentionsInLocation(spaceId);
    const { room, isConnected } = useLiveKitConnection(spaceId);
    
    // Remove singleton logic, refs no longer needed
    
    return { beings, intentions, isConnected, room };
}
```

#### Testing:
- Test room connection/disconnection
- Verify multiple components can use sync independently
- Test space switching behavior

### Commit 3: Implement Direct Query Invalidation
**Scope:** Replace ref juggling with proper query invalidation
**Files Changed:** 3-4 files
**Risk:** LOW (cleaner patterns)

#### Changes:
1. **Create `src/hooks/use-livekit-sync.ts`**
```typescript
export function useLiveKitSync(locationId: string): void {
    const queryClient = useQueryClient();
    const { room } = useLiveKitConnection(locationId);
    
    useEffect(() => {
        if (!room) return;
        
        const handleDataReceived = (
            payload: Uint8Array,
            participant?: RemoteParticipant,
            kind?: any,
            topic?: string,
        ) => {
            if (topic !== "sync") return;
            
            try {
                const text = new TextDecoder().decode(payload);
                const event = JSON.parse(text) as SyncEvent;
                
                // Direct query invalidation based on event type
                switch (event.type) {
                    case 'being-created':
                    case 'being-updated':
                        queryClient.invalidateQueries({
                            queryKey: ['being', 'getByLocation', { locationId }]
                        });
                        break;
                    case 'intention-created':
                    case 'intention-updated':
                        queryClient.invalidateQueries({
                            queryKey: ['intention', 'getAllUtterancesInBeing', { beingId: locationId }]
                        });
                        break;
                }
            } catch (error) {
                console.error("Error parsing sync event:", error);
            }
        };
        
        room.on(RoomEvent.DataReceived, handleDataReceived);
        
        return () => {
            room.off(RoomEvent.DataReceived, handleDataReceived);
        };
    }, [room, locationId, queryClient]);
}
```

2. **Update `src/hooks/use-sync.ts`**
```typescript
export function useSync(spaceId: string) {
    const beings = useBeingsInLocation(spaceId);
    const intentions = useIntentionsInLocation(spaceId);
    const { room, isConnected } = useLiveKitConnection(spaceId);
    
    // Auto-sync when connected
    useLiveKitSync(spaceId);
    
    return { beings, intentions, isConnected, room };
}
```

#### Testing:  
- Test sync event handling
- Verify query invalidation works correctly
- Test performance vs old ref-based approach

### Commit 4: Remove Unnecessary Abstractions & Add Optimistic Updates
**Scope:** Clean up unused code, add performance optimizations
**Files Changed:** 5-6 files  
**Risk:** LOW (removing unused code)

#### Changes:
1. **Remove `src/lib/sync/server-sync.ts`**
2. **Update `src/lib/being-operations.ts`**
```typescript
// Replace ServerSync usage with direct function call
import { broadcastSyncEvent } from "~/server/lib/livekit";

// Replace:
// await serverSync.broadcast({ ... });
// With:
await broadcastSyncEvent(locationId, {
    type: "being-created",
    data: { id: input.id },
    timestamp: new Date().toISOString(),
    locationId: input.locationId,
});
```

3. **Create `src/hooks/use-optimistic-intentions.ts`**
```typescript
export function useOptimisticIntentions(locationId: string) {
    const intentions = useIntentionsInLocation(locationId);
    const [optimisticIntentions, setOptimisticIntentions] = useState<Intention[]>([]);
    
    const addOptimistic = useCallback((intention: Partial<Intention>) => {
        const optimistic: Intention = {
            id: `temp-${Date.now()}`,
            createdAt: new Date(),
            modifiedAt: new Date(),
            ...intention,
        } as Intention;
        
        setOptimisticIntentions(prev => [...prev, optimistic]);
        
        // Auto-remove after 30 seconds if not confirmed
        setTimeout(() => {
            setOptimisticIntentions(prev => 
                prev.filter(i => i.id !== optimistic.id)
            );
        }, 30000);
    }, []);
    
    const removeOptimistic = useCallback((id: string) => {
        setOptimisticIntentions(prev => prev.filter(i => i.id !== id));
    }, []);
    
    // Merge real and optimistic intentions
    const allIntentions = useMemo(() => {
        const realIds = new Set(intentions.map(i => i.id));
        const validOptimistic = optimisticIntentions.filter(i => !realIds.has(i.id));
        return [...intentions, ...validOptimistic].sort((a, b) => 
            a.createdAt.getTime() - b.createdAt.getTime()
        );
    }, [intentions, optimisticIntentions]);
    
    return {
        intentions: allIntentions,
        addOptimistic,
        removeOptimistic
    };
}
```

4. **Update components to use optimistic updates**

#### Testing:
- Verify all abstractions removed cleanly  
- Test optimistic updates in chat interface
- Ensure no regressions in sync behavior

## Migration Strategy

### Phase 1: Parallel Implementation (Commits 1-2)
- New hooks work alongside existing `useSync`
- Components can gradually migrate
- Full backward compatibility maintained
- Easy rollback if issues discovered

### Phase 2: Component Migration (Commit 3)
- Update components one by one
- `useSync` becomes composition of focused hooks
- Maintains same public API
- Performance improvements visible

### Phase 3: Optimization & Cleanup (Commit 4)  
- Remove unused abstractions
- Add optimistic updates for better UX
- Final performance tuning
- Complete the simplification

### Rollback Plan
Each commit is reversible:
1. **Commit 1-2:** Simply revert, no breaking changes
2. **Commit 3:** Revert to ref-based approach if needed
3. **Commit 4:** Re-add abstractions if optimizations cause issues

## Expected Benefits

### Developer Experience
- **Clearer mental model:** Each hook has single responsibility
- **Better testability:** Isolated concerns easier to test
- **Easier debugging:** Smaller, focused functions
- **Reduced complexity:** No more ref juggling

### Performance  
- **Optimistic updates:** Instant UI feedback
- **Better caching:** TanStack Query handles caching properly
- **Reduced network requests:** Only invalidate what changed
- **Memory efficiency:** No singleton leaks

### Maintainability
- **Fewer abstractions:** Direct function calls where appropriate
- **React patterns:** Proper hook composition
- **Clear boundaries:** Data/connection/sync concerns separated
- **Future flexibility:** Easy to extend or modify individual pieces

## Risk Assessment

### Low Risk Items
- Creating new focused hooks (pure addition)
- Removing unused abstractions
- Adding optimistic updates

### Medium Risk Items  
- Removing singleton pattern (connection behavior changes)
- Query invalidation changes (sync timing)

### Mitigation Strategies
- **Gradual rollout:** Each commit is independently valuable
- **Backward compatibility:** Keep existing APIs during transition
- **Comprehensive testing:** Test each layer independently
- **Feature flags:** Can gate optimistic updates if needed

## Success Metrics

### Code Quality
- **Lines of code:** Expect 20-30% reduction in sync-related code
- **Cyclomatic complexity:** Hooks should have lower complexity scores
- **Test coverage:** Each hook should be >90% tested

### Performance
- **Network requests:** Reduce redundant fetches by 40-60%
- **User experience:** Optimistic updates show immediate feedback
- **Memory usage:** No singleton leaks between space switches

### Developer Metrics
- **Time to understand:** New developers should grok system faster
- **Debugging time:** Issues should be easier to isolate and fix
- **Feature velocity:** New sync-related features easier to add

## Conclusion

This sync system simplification addresses the core architectural issues identified in the design assessment while maintaining full backward compatibility and providing a clear migration path. The focused hooks approach aligns with React best practices and provides better performance, testability, and maintainability.

The plan is designed to be **low-risk** with **high-reward** - each commit provides independent value and can be rolled back if needed. The end result will be a **cleaner, faster, and more maintainable** sync system that serves as a solid foundation for future development.

**Recommendation:** Proceed with implementation as outlined. The architectural benefits significantly outweigh the implementation complexity, and the gradual migration strategy minimizes risk while maximizing learning opportunities.

---

*Implementation plan prepared by Claude Code Analysis*  
*Ready for development team review and execution*