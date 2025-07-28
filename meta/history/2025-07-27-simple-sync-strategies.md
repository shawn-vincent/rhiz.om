# 5 Simple Sync Strategies for Chat and Live Updates
Date: 2025-07-27
Author: Claude Code

## Design Principles
1. **Simplicity** - Fewer moving parts, obvious behavior
2. **Elegance** - Clean abstractions, minimal complexity
3. **Developer Experience** - Easy to understand and debug

## Strategy 1: Single SSE + Message Queue
**"One pipe, one queue"**

### How it works:
```typescript
// Server sends ALL updates through one SSE connection
type Update = 
  | { type: 'message', id: string, content: string, complete: boolean }
  | { type: 'presence', beingId: string, online: boolean }
  | { type: 'typing', beingId: string, typing: boolean }

// Client maintains single update queue
const updates = new Queue<Update>();
const sse = new EventSource('/api/updates');
sse.onmessage = (e) => updates.push(JSON.parse(e.data));

// Process queue every 16ms (60fps)
setInterval(() => {
  while (!updates.isEmpty()) {
    const update = updates.pop();
    applyUpdate(update);
  }
}, 16);
```

### Pros:
- One connection for everything
- Natural ordering of updates
- Easy to debug (just log the queue)
- Handles bursts gracefully

### Cons:
- 16ms latency on updates
- Need to handle queue overflow

## Strategy 2: HTTP Polling + Local State Machine
**"Pull, don't push"**

### How it works:
```typescript
// Poll for updates every 2 seconds
let lastVersion = 0;
setInterval(async () => {
  const updates = await fetch(`/api/changes?since=${lastVersion}`);
  const { version, changes } = await updates.json();
  
  // Apply all changes in order
  changes.forEach(change => {
    localState.apply(change);
  });
  
  lastVersion = version;
}, 2000);

// Optimistic updates for user actions
function sendMessage(text) {
  const tempId = generateId();
  localState.addMessage({ id: tempId, text, pending: true });
  
  fetch('/api/messages', { method: 'POST', body: { text } })
    .then(({ id }) => localState.confirmMessage(tempId, id))
    .catch(() => localState.failMessage(tempId));
}
```

### Pros:
- Dead simple - it's just HTTP
- Works everywhere (no WebSocket/SSE issues)
- Natural retry with each poll
- Easy to test and debug

### Cons:
- 2-second latency
- More server load from polling

## Strategy 3: Write-Through Cache Pattern
**"Client owns display state"**

### How it works:
```typescript
// All state lives in client, server is just backup
class ChatState {
  messages = new Map();
  
  // User sends message
  sendMessage(text) {
    const msg = { id: genId(), text, timestamp: Date.now() };
    this.messages.set(msg.id, msg);
    this.render();
    
    // Fire and forget to server
    fetch('/api/messages', { 
      method: 'POST', 
      body: JSON.stringify(msg) 
    }).catch(() => {
      // Mark as failed, let user retry
      msg.failed = true;
      this.render();
    });
  }
  
  // Periodically sync with server
  async sync() {
    const serverMessages = await fetch('/api/messages').then(r => r.json());
    
    // Merge server state with local
    serverMessages.forEach(msg => {
      if (!this.messages.has(msg.id)) {
        this.messages.set(msg.id, msg);
      }
    });
    
    this.render();
  }
}

// Sync every 5 seconds
setInterval(() => chatState.sync(), 5000);
```

### Pros:
- Instant UI updates
- Works offline
- Client has full control
- Simple mental model

### Cons:
- Conflict resolution complexity
- More client-side code

## Strategy 4: Event Log Streaming
**"Append-only truth"**

### How it works:
```typescript
// Server maintains append-only event log
type Event = 
  | { seq: number, type: 'message', beingId: string, text: string }
  | { seq: number, type: 'presence', beingId: string, online: boolean }

// Client tracks last seen sequence
let lastSeq = 0;

// Single SSE for events
const sse = new EventSource(`/api/events?after=${lastSeq}`);
sse.onmessage = (e) => {
  const event = JSON.parse(e.data);
  
  // Apply event to local state
  switch (event.type) {
    case 'message':
      state.messages.push(event);
      break;
    case 'presence':
      state.presence[event.beingId] = event.online;
      break;
  }
  
  lastSeq = event.seq;
  render();
};

// Reconnect automatically continues from lastSeq
```

### Pros:
- Perfect ordering guaranteed
- Natural replay/recovery
- Can rebuild state from any point
- Audit trail built-in

### Cons:
- Requires sequence number management
- Event log can grow large

## Strategy 5: Hybrid Push/Pull
**"Push deltas, pull full state"**

### How it works:
```typescript
// SSE for real-time deltas only
const sse = new EventSource('/api/deltas');
sse.onmessage = (e) => {
  const delta = JSON.parse(e.data);
  
  // Only apply if we have base state
  if (state.version === delta.baseVersion) {
    state.apply(delta);
    state.version = delta.newVersion;
  } else {
    // Version mismatch, need full refresh
    fullRefresh();
  }
};

// Pull full state on connect and on version mismatch
async function fullRefresh() {
  const fullState = await fetch('/api/state').then(r => r.json());
  state = fullState;
  render();
}

// Initial load
fullRefresh();
```

### Pros:
- Fast incremental updates
- Automatic recovery from desync
- Bandwidth efficient
- Simple version checking

### Cons:
- Two code paths (delta vs full)
- Version tracking overhead

## Recommendation: Strategy 1 (Single SSE + Message Queue)

For maximum simplicity while maintaining good UX:

1. **One SSE connection** for all updates
2. **Simple message queue** for buffering
3. **60fps processing loop** for smooth updates
4. **Explicit message types** for clarity

### Implementation Sketch:
```typescript
// Shared types
interface Update {
  type: 'message' | 'presence' | 'typing';
  data: any;
  timestamp: number;
}

// Server
class UpdateBroadcaster {
  broadcast(spaceId: string, update: Update) {
    const connections = this.connections.get(spaceId);
    const json = JSON.stringify(update);
    connections.forEach(conn => conn.send(json));
  }
}

// Client  
class SyncClient {
  private queue: Update[] = [];
  private sse: EventSource;
  
  connect(spaceId: string) {
    this.sse = new EventSource(`/api/sync/${spaceId}`);
    this.sse.onmessage = (e) => {
      this.queue.push(JSON.parse(e.data));
    };
    
    // Process queue at 60fps
    this.startProcessing();
  }
  
  private startProcessing() {
    setInterval(() => {
      while (this.queue.length > 0) {
        const update = this.queue.shift()!;
        this.handleUpdate(update);
      }
    }, 16);
  }
  
  private handleUpdate(update: Update) {
    // Update UI based on update type
    switch (update.type) {
      case 'message':
        this.addMessage(update.data);
        break;
      // ... etc
    }
  }
}
```

This approach is:
- **Simple**: One connection, one queue, one processing loop
- **Debuggable**: Can log all updates easily
- **Performant**: Batches UI updates at 60fps
- **Reliable**: Queue handles bursts, SSE auto-reconnects