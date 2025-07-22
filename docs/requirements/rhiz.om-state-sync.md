# Rhiz.om State Synchronization — Version-Based Reliability Spec

**Version 1.0 · 2025-07-22**

---

## 1 Purpose & Goals

Maintains **perfect consistency** between server and all connected clients using version-controlled snapshots and SSE streams. Eliminates race conditions and sync drift through monotonic versioning and authoritative server state.

**Core Principles:**
- Server is the single source of truth
- Clients are pure slaves (read-only views)
- All state changes flow through server
- Version numbers detect missed updates
- Snapshots provide recovery mechanism

---

## 2 Data Models Covered

| Model | Description | Initial Use Case |
|-------|-------------|------------------|
| **Space Presence** | All beings in space (location + connection status) | User list, avatars, video call participants |
| **Space Intentions** | Messages/actions in current space | Chat messages, bot responses, errors |
| **Future Models** | Extensible to any shared state | Documents, collaborative editing, etc. |

---

## 3 Core Architecture

### 3.1 Version System
```ts
interface VersionedState<T> {
  /** Monotonic version counter (starts at 1) */
  version: number;
  
  /** Complete state snapshot at this version */
  data: T;
  
  /** Server timestamp when version was created */
  timestamp: string; // ISO-8601
  
  /** Optional metadata about the change */
  changeInfo?: {
    type: 'add' | 'update' | 'remove';
    entityId?: string;
    causedBy?: BeingId;
  };
}
```

### 3.2 State Models
```ts
/** All beings in a space (location-based + connection status) */
interface SpacePresence {
  spaceId: BeingId;
  beings: {
    being: Being; // being.location === spaceId
    connectionStatus: 'online' | 'away' | 'offline';
    lastSeen: string; // Last connection activity
    joinedAt: string; // When they entered the space (set location)
  }[];
}

/** Active intentions in a space */
interface SpaceIntentions {
  spaceId: BeingId;
  intentions: Intention[]; // intentions.location === spaceId
}
```

---

## 4 Server-Side Implementation

### 4.1 Version Management
```ts
class StateManager<T> {
  private currentVersion = 0;
  private currentState: T;
  private subscribers = new Set<SSEConnection>();
  
  /** Update state and broadcast to all clients */
  updateState(newState: T, changeInfo?: ChangeInfo): void {
    this.currentVersion++;
    this.currentState = newState;
    
    const versionedState: VersionedState<T> = {
      version: this.currentVersion,
      data: newState,
      timestamp: new Date().toISOString(),
      changeInfo
    };
    
    // Broadcast to all subscribers
    this.broadcast(versionedState);
  }
  
  /** Get current snapshot */
  getSnapshot(): VersionedState<T> {
    return {
      version: this.currentVersion,
      data: this.currentState,
      timestamp: new Date().toISOString()
    };
  }
}
```

### 4.2 API Integration

**Normal tRPC API (existing patterns):**
```ts
// Standard queries - work exactly as before
api.being.getByLocation.useQuery({ locationId: "@space" });
api.intention.getAllUtterancesInBeing.useQuery({ beingId: "@space" });

// Mutations through existing procedures
api.being.upsert.useMutation();
api.intention.createUtterance.useMutation();
```

**New Streaming Endpoints (follows existing EventSource pattern):**
```ts
// GET /api/sync/stream?model=presence&spaceId=@space
// GET /api/sync/stream?model=intentions&spaceId=@space
// GET /api/sync/snapshot?model=presence&spaceId=@space
```

---

## 5 Client-Side Implementation

### 5.1 Integration with Existing API

**Philosophy:** Use tRPC for normal operations, streaming for live updates
```ts
// Normal usage - unchanged
const { data: beings } = api.being.getByLocation.useQuery({ locationId: spaceId });

// NEW: Live synchronized version
const { data: presence, version } = useSpacePresence(spaceId);
```

### 5.2 Sync Client Implementation
```ts
class StateSyncClient<T> {
  private currentVersion = 0;
  private eventSource: EventSource;
  private onStateUpdate: (state: VersionedState<T>) => void;
  
  connect(model: string, spaceId: string) {
    // Start SSE stream (follows existing pattern like /api/chat-stream)
    this.eventSource = new EventSource(
      `/api/sync/stream?model=${model}&spaceId=${spaceId}`
    );
    
    this.eventSource.onmessage = (event) => {
      const update: VersionedState<T> = JSON.parse(event.data);
      this.handleUpdate(update);
    };
    
    // Get initial snapshot
    this.requestSnapshot(model, spaceId);
  }
  
  private handleUpdate(update: VersionedState<T>) {
    // Check for missed versions
    if (update.version !== this.currentVersion + 1) {
      console.warn(`Version gap detected: ${this.currentVersion} → ${update.version}`);
      this.requestSnapshot(); // Re-sync from snapshot
      return;
    }
    
    this.currentVersion = update.version;
    this.onStateUpdate(update);
  }
  
  private async requestSnapshot(model: string, spaceId: string) {
    const snapshot = await fetch(`/api/sync/snapshot?model=${model}&spaceId=${spaceId}`);
    const state: VersionedState<T> = await snapshot.json();
    
    this.currentVersion = state.version;
    this.onStateUpdate(state);
  }
}
```

### 5.3 React Integration (follows existing patterns)

**Sync hooks (similar to existing tRPC patterns):**
```ts
function useSpacePresence(spaceId: BeingId) {
  const [presence, setPresence] = useState<SpacePresence | null>(null);
  const [version, setVersion] = useState(0);
  
  useEffect(() => {
    const client = new StateSyncClient<SpacePresence>();
    
    client.onStateUpdate = (versionedState) => {
      setPresence(versionedState.data);
      setVersion(versionedState.version);
    };
    
    client.connect('presence', spaceId);
    
    return () => client.disconnect();
  }, [spaceId]);
  
  // Derived state for UI convenience
  const onlineBeings = presence?.beings.filter(b => b.connectionStatus === 'online') ?? [];
  const offlineBeings = presence?.beings.filter(b => b.connectionStatus === 'offline') ?? [];
  
  return { presence, version, onlineBeings, offlineBeings };
}

function useSpaceIntentions(spaceId: BeingId) {
  const [intentions, setIntentions] = useState<SpaceIntentions | null>(null);
  const [version, setVersion] = useState(0);
  
  useEffect(() => {
    const client = new StateSyncClient<SpaceIntentions>();
    
    client.onStateUpdate = (versionedState) => {
      setIntentions(versionedState.data);
      setVersion(versionedState.version);
    };
    
    client.connect('intentions', spaceId);
    
    return () => client.disconnect();
  }, [spaceId]);
  
  return { intentions: intentions?.intentions ?? [], version };
}
```

**Migration path from existing code:**
```ts
// OLD: Static query (still works)
const { data: utterances } = api.intention.getAllUtterancesInBeing.useQuery(
  { beingId: spaceId }, 
  { staleTime: 0 } // Manual refresh
);

// NEW: Live synced version
const { intentions } = useSpaceIntentions(spaceId); // Auto-updates
```

---

## 6 Reliability Guarantees

### 6.1 Consistency Rules
1. **Single Source of Truth**: Only server modifies state
2. **Monotonic Versions**: Version numbers never decrease or skip
3. **Atomic Updates**: Each version represents complete, valid state
4. **Gap Detection**: Clients detect missed versions and re-sync
5. **Snapshot Recovery**: Any client can recover from any state

### 6.2 Failure Handling
| Failure Case | Detection | Recovery |
|--------------|-----------|----------|
| Network interruption | SSE connection lost | Auto-reconnect + snapshot |
| Missed messages | Version gap detected | Request fresh snapshot |
| Server restart | Version reset to 1 | All clients re-sync |
| Client crash | — | Snapshot on reconnect |

---

## 7 Performance Considerations

### 7.1 Optimization Strategies
- **Differential Updates**: Only send changed entities (optional enhancement)
- **Compression**: gzip SSE streams
- **Batching**: Group rapid updates into single version
- **TTL Snapshots**: Cache snapshots for faster client onboarding

### 7.2 Scaling Limits
- **Clients per Space**: 1000+ concurrent connections
- **Update Frequency**: 10-100 updates/second per space
- **Snapshot Size**: <100KB for typical space state

---

## 8 Security & Access Control

### 8.1 Authentication
- All sync endpoints require valid session
- Space access verified via being location/ownership
- SSE connections authenticate via session cookies

### 8.2 Authorization Rules
- Can subscribe to space state if being.location === spaceId (same as existing presence API)
- Can mutate state via existing tRPC procedures with existing auth rules
- No raw state exposure across space boundaries
- Streaming endpoints use same session validation as existing EventSource endpoints

---

## 9 Error Handling

### 9.1 Server Errors
```ts
interface SyncError {
  type: 'auth_error' | 'version_conflict' | 'invalid_mutation';
  message: string;
  currentVersion?: number;
}
```

### 9.2 Client Resilience
- Exponential backoff for reconnection
- Graceful degradation when sync fails
- User notification for persistent sync issues
- Offline mode with read-only cached state

---

## 10 Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Version management system
- [ ] SSE streaming endpoints
- [ ] Snapshot API
- [ ] Basic client sync logic

### Phase 2: Space Models
- [ ] SpacePresence implementation
- [ ] SpaceIntentions implementation
- [ ] React hooks integration
- [ ] UI binding for live updates

### Phase 3: Reliability Features
- [ ] Gap detection & recovery
- [ ] Connection resilience
- [ ] Performance monitoring
- [ ] Error reporting

---

## 11 Testing Strategy

### 11.1 Reliability Tests
- Network interruption simulation
- Concurrent client stress testing
- Version gap injection
- Server restart scenarios

### 11.2 Performance Tests
- High-frequency update handling
- Large snapshot loading
- Memory leak detection
- Connection scaling limits

---

**"Perfect synchronization through perfect simplicity."** — Design Philosophy

---

## 12 API Reference

### 12.1 Endpoint Specifications

**Streaming Updates (follows /api/chat-stream pattern):**
```
GET /api/sync/stream?model=presence&spaceId=@space-id
GET /api/sync/stream?model=intentions&spaceId=@space-id
```

**Snapshots (standard REST):**
```
GET /api/sync/snapshot?model=presence&spaceId=@space-id
GET /api/sync/snapshot?model=intentions&spaceId=@space-id
```

**Mutations (existing tRPC procedures - unchanged):**
```ts
api.being.upsert.useMutation() // Updates presence when location changes
api.intention.createUtterance.useMutation() // Adds to space intentions
api.presence.updateStatus.useMutation() // Updates connection status (if added)
```

### 12.2 SSE Stream Format
```
event: state-update
data: {"version": 42, "data": {...}, "timestamp": "2025-07-22T10:30:00Z"}

event: error
data: {"type": "version_conflict", "message": "...", "currentVersion": 41}
```

### 12.3 Snapshot Response
```json
{
  "version": 42,
  "data": {
    "spaceId": "@two-trees-community",
    "beings": [
      {
        "being": { "id": "@forest-keeper", "name": "Forest Keeper", ... },
        "connectionStatus": "online",
        "lastSeen": "2025-07-22T10:29:45Z",
        "joinedAt": "2025-07-22T09:15:30Z"
      },
      {
        "being": { "id": "@sleeping-owl", "name": "Sleeping Owl", ... },
        "connectionStatus": "offline", 
        "lastSeen": "2025-07-22T08:45:12Z",
        "joinedAt": "2025-07-22T08:30:00Z"
      }
    ]
  },
  "timestamp": "2025-07-22T10:30:00Z"
}
```

---

**End of specification.**