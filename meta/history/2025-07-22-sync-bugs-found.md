# State Synchronization System: In-Depth Bug Report

**Date:** 2025-07-22

This document outlines the findings from a detailed, line-by-line review of the new versioned state synchronization mechanism. The focus was on identifying bugs, race conditions, and other issues that could compromise data integrity or system stability.

---

## 1. Bugs Causing Incorrect Client Information

These bugs directly lead to clients displaying stale, inconsistent, or incorrect data.

### 1.1. Incorrect Timestamps in Presence Data

- **File:** `src/server/lib/state-sync.ts`
- **Function:** `fetchSpacePresence`
- **Bug:** The `lastSeen` property for a being is hardcoded to the time of the snapshot (`new Date().toISOString()`), not the user's actual last activity. The `joinedAt` property incorrectly uses `being.modifiedAt`, which is not a stable representation of when a user entered a space.
- **Impact:** All clients see incorrect presence details, making it impossible to know when a user was truly last active or when they joined.

### 1.2. Client-Side Connection Race Condition & Failure

- **File:** `src/lib/state-sync-client.ts`
- **Function:** `startConnection`
- **Bug:** The `EventSource` connection is only initiated *after* the initial snapshot request succeeds. If the snapshot fetch fails for any reason (e.g., a temporary network blip), the client gives up and never attempts to connect to the live stream or retry the snapshot.
- **Impact:** The client is left in a permanently disconnected state, displaying stale or empty information without any recovery mechanism.

### 1.3. Delayed and Unreliable Presence Updates on Disconnect

- **File:** `src/server/lib/state-sync.ts`
- **Function:** `cleanupConnection`
- **Bug:** The function uses a `setTimeout(..., 100)` to delay triggering a presence update after a client disconnects. Using a fixed timeout to handle a race condition is inherently unreliable.
- **Impact:** When a user disconnects, all other clients continue to see them as "online" for at least 100ms, and potentially longer, leading to a confusing and inconsistent UI.

---

## 2. Server-Side Stability and Performance Bugs

These bugs affect the long-term health, performance, and stability of the server.

### 2.1. Memory and Resource Leaks

- **File:** `src/server/lib/state-sync.ts`
- **Bug 1 (Memory):** The `stateManagers` map is never cleared. `StateManager` instances are created for every space requested but are never garbage-collected, even after all users leave.
- **Bug 2 (Resources):** The `StateManager` class starts a `setInterval` for its heartbeat, but its `destroy()` method (which clears the interval) is never called.
- **Impact:** The Node.js process will slowly leak memory and accumulate active timers, eventually leading to performance degradation and a server crash.

### 2.2. Inefficient State Updates (Thundering Herd)

- **File:** `src/server/lib/state-sync.ts`
- **Functions:** `triggerPresenceUpdate`, `triggerIntentionsUpdate`
- **Bug:** Every minor state change (e.g., one user connecting) triggers a full re-fetch of the *entire* state for that model from the database. This is highly inefficient.
- **Impact:** The database will be put under unnecessary load, and the system will not scale to even a moderate number of users or a high frequency of events.

### 2.3. Unhandled Promise Rejection in Stream Route

- **File:** `src/app/api/sync/stream/route.ts` (Inferred)
- **Bug:** If the `initialStateFactory` promise in `getStateManager` is rejected (e.g., DB connection fails), the error is not caught within the stream's API route.
- **Impact:** An unhandled promise rejection can crash the entire Node.js server process.

---

## 3. Security Vulnerabilities

### 3.1. Missing Authorization on API Endpoints

- **Files:** `src/app/api/sync/snapshot/route.ts`, `src/app/api/sync/stream/route.ts` (Inferred)
- **Bug:** The API routes do not appear to verify that the authenticated user has the rights to access the requested `spaceId`.
- **Impact:** This is a critical security flaw. Any authenticated user could potentially access the presence and intention data of *any* space in the system, even private ones.

---

## 4. Incomplete or Minor Bugs

### 4.1. Inefficient Client-Side Polling

- **File:** `src/hooks/use-state-sync.ts`
- **Bug:** The `useStateSync` hook uses a `setInterval` to poll the client's connection status every second. This is inefficient and should be event-driven, as the client already has `onopen` and `onerror` events.

### 4.2. Incomplete Fallback Logic

- **File:** `src/hooks/use-state-sync.ts`
- **Bug:** The `...WithFallback` hooks are unimplemented `TODO`s.

### 4.3. Incomplete Gap Detection

- **File:** `src/lib/state-sync-client.ts`
- **Bug:** The version gap check in `handleUpdate` doesn't account for receiving old or duplicate messages (`update.version <= this.currentVersion`).
