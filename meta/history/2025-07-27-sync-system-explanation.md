# Sync System Explanation

*Date: 2025-07-27*

## <10 Word Explanation

EventSource streams database changes to React components automatically.

## <50 Word Explanation

**Added from <10 word:** Specific components and data flow.

Server broadcasts real-time database updates (beings, intentions) via EventSource to React hooks. Components subscribe to space-specific streams, receiving live data without manual refreshes. Database events trigger automatic broadcasts to connected clients.

## <150 Word Explanation

**Added from <50 word:** Technical architecture and implementation details.

The sync system uses Server-Sent Events (EventSource) for real-time data synchronization. When clients connect, they establish EventSource connections to `/api/stream` with space filters. The server maintains active connections and sends initial data immediately.

Database operations emit events (`being:updated`, `intention:created`) that trigger broadcasts to matching connections. The server queries fresh data and sends it via SSE to all relevant clients. React hooks (`useSync`, `useSpaceStream`) manage connections and update component state automatically.

Components use `useSpaceDataContext()` to access live data without manual API calls. The system handles connection management, reconnection, and state updates transparently. Filtering ensures clients only receive relevant updates for their space/types.

## Full Explanation

**Added from <150 word:** Complete implementation details, file structure, data flow patterns, and error handling.

### Architecture Overview

The sync system provides real-time data synchronization between the database and React components using Server-Sent Events (EventSource). It's designed around simplicity: direct database → SSE → React state updates without complex queues or state machines.

### Server-Side Components

#### `/src/server/lib/stream.ts`
- **Connection Management**: Maintains a `Map<string, Connection>` of active SSE connections
- **Initial Data**: Sends current space data immediately when clients connect
- **Event Broadcasting**: Listens for database events and broadcasts updates to matching connections
- **Filtering**: Supports space-specific and type-specific filtering (beings, intentions)

**Key Functions:**
- `getSpaceBeings(spaceId)`: Queries beings in a space, ordered by name
- `getSpaceIntentions(spaceId)`: Queries intentions in chronological order (no limit)
- `broadcast(event, filter)`: Sends events to matching connections
- `sendInitialData(connectionId)`: Sends current state on connection

#### Event Listeners
```typescript
emitter.on("being:updated", async (beingId: string, spaceId?: string))
emitter.on("intention:created", async (intentionId: string, spaceId: string))
```

Database operations trigger these events, which query fresh data and broadcast to relevant connections.

#### `/src/app/api/stream/route.ts` (implied)
Handles SSE connection establishment, parses query parameters for space/type filtering, and sets up the EventSource endpoint.

### Client-Side Components

#### `/src/lib/stream.ts`
- **Connection Management**: Creates and manages EventSource connections
- **Event Parsing**: Uses `superjson` to deserialize server events
- **Callback System**: Supports multiple subscribers per connection
- **State Tracking**: Monitors connection readiness

**Key Functions:**
- `connect(spaceId?, types?)`: Establishes EventSource connection
- `subscribe(connectionId, callback)`: Registers event handlers
- `disconnect(connectionId)`: Closes connections and cleanup
- `isConnected(connectionId)`: Checks connection state

#### `/src/hooks/use-stream.ts`
React hooks that bridge the stream system to component state:

- `useSync(spaceId?, types?)`: Core hook managing connection lifecycle
- `useSpaceStream(spaceId)`: Legacy compatibility wrapper

**State Management:**
```typescript
const [beings, setBeings] = useState<Being[]>([]);
const [intentions, setIntentions] = useState<Intention[]>([]);
const [connected, setConnected] = useState(false);
```

#### `/src/hooks/use-space-data-context.tsx`
Compatibility layer providing the old context API while using the new stream system internally. Includes:

- Being cache with global + stream data merging
- Legacy `utterances` alias for `intentions`
- Presence simulation (`isOnline: true`)
- Helper functions (`getBeing`, `beingMap`)

### Data Flow

1. **Connection**: Component mounts → `useSync` → `connect()` → EventSource to `/api/stream`
2. **Initial Data**: Server sends current beings/intentions for the space
3. **Live Updates**: Database changes → event emission → broadcast → client state update
4. **Component Updates**: React re-renders automatically when hook state changes

### Event Types

```typescript
type SyncEvent =
  | { type: "beings"; data: Being[] }
  | { type: "intentions"; data: Intention[] };
```

### Filtering and Optimization

- **Space Filtering**: Clients only receive updates for their specific space
- **Type Filtering**: Can subscribe to only "beings" or "intentions" 
- **Connection Reuse**: Multiple hooks can share the same EventSource connection
- **Automatic Cleanup**: Connections close when components unmount

### Error Handling

- **Client**: Connection errors logged, automatic reconnection via React hook cleanup/restart
- **Server**: Failed sends remove connections, errors logged with context
- **Parsing**: `superjson` failures logged but don't crash the system

### Key Design Decisions

1. **No Queues**: Direct database → broadcast pattern for simplicity
2. **No Heartbeats**: Relies on EventSource's built-in connection management
3. **No Classes**: Functional approach with simple state management
4. **Superjson**: Handles complex object serialization (Dates, etc.)
5. **Unlimited Messages**: Removed arbitrary limits for complete data sync
6. **Chronological Order**: Intentions ordered oldest-first for natural chat flow

### Integration Points

- **Database Events**: Triggered by tRPC mutations and bot operations
- **Chat Component**: Uses `useSpaceDataContext()` for real-time message display
- **Being Management**: Live updates when users join/leave spaces
- **Bot Responses**: Streaming bot messages appear in real-time via intention updates

The system provides seamless real-time synchronization while maintaining a simple, debuggable architecture that scales well with the application's entity-based data model.