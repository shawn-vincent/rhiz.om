# Orin Architecture Cleanup Plan
*Date: 2025-07-27*
*Status: DRIFTING → CLEAN*
*Priority: HIGH - Required before scaling*

## Executive Summary

The rhiz.om codebase demonstrates solid T3 Stack foundations but suffers from **boundary drift** and **surface bloat** that threatens maintainability and performance. This document outlines a systematic plan to restore architectural integrity while preserving the elegant Being/Intention domain model.

**Current State:** DRIFTING (13 boundary violations, 8 surface bloat patterns, 5 temporal vulnerabilities)  
**Target State:** CLEAN (Minimal surfaces, clear boundaries, composable primitives)  
**Estimated Effort:** 12-16 hours across 4 phases

---

## Critical Issues Analysis

### Boundary Violations (13 Total)

#### Database → API Leakage
- **`/src/server/api/routers/being.ts:40`** - Direct Drizzle schema parsing in router response
- **`/src/server/api/routers/being.ts:120`** - Business logic mixed with persistence concerns  
- **`/src/app/api/beings/route.ts:118`** - Database transaction logic in REST handler

#### Authentication → Business Logic Bleeding
- **`/src/server/api/trpc.ts:132-145`** - Authorization middleware tightly coupled to tRPC
- **`/src/server/auth/config.ts:114-172`** - Being creation logic embedded in auth callback
- **`/src/app/api/sync/route.ts:35-61`** - Session handling mixed with real-time transport

#### State Management → Component Coupling
- **`/src/hooks/use-space-data-context.tsx:22-28`** - Global cache mutation in component hook
- **`/src/hooks/use-space-data-context.tsx:104-163`** - EventSource management in React context
- **`/src/app/_components/being-editor.tsx:39-47`** - tRPC mutation in form component

#### Real-time → Multiple Protocol Violations
- **`/src/server/lib/simple-sync.ts:135-159`** - Heartbeat timer as global side effect
- **`/src/hooks/use-space-data-context.tsx:19-20`** - Global connection tracking in client
- **`/src/app/api/sync/route.ts:77-91`** - Manual cleanup logic scattered across handlers

#### Type System Violations
- **`/src/server/db/types.ts:16-30`** - Recursive type definitions creating circular dependencies

### Surface Area Bloat (8 Patterns)

#### Over-Exposed APIs
- **Duplicate CRUD:** REST APIs in `/api/beings/` and `/api/intentions/` redundant with tRPC
- **Hook Explosion:** 6 custom hooks with overlapping responsibilities
- **Modal Redundancy:** 3 different modal patterns for same use cases

#### Unnecessary Abstractions
- **`/src/hooks/use-simple-sync.ts`** - Single-call wrapper around fetch API (40 lines)
- **`/packages/entity-kit/src/types.ts`** - 9-line type file requiring separate package
- **`/src/server/lib/auth.ts`** - One-function module for `getAuthContext`

#### Configuration Complexity
- **Environment Variables:** 7 required env vars for minimal functionality
- **tRPC Procedures:** 3 different authorization levels creating confusion
- **Component Variants:** Multiple patterns where one would suffice

### Temporal Vulnerabilities (5 Critical)

#### Race Conditions
- **Global Cache Mutations:** Multiple EventSource connections updating same Map
- **Bot Activation:** No locking prevents duplicate responses
- **Connection Cleanup:** EventSource abort handlers race with manual cleanup

#### Missing Idempotency
- **Being Upsert:** No deduplication for rapid successive saves
- **Intention Creation:** Random UUIDs allow duplicate messages

---

## Phase-by-Phase Cleanup Plan

### Phase 1: Boundary Enforcement (Safe, 3-4 hours)

**Goal:** Extract pure domain layer and consolidate authentication

#### 1.1 Create Domain Service Layer
```typescript
// NEW: /src/domain/being-service.ts
export class BeingService {
  async createBeing(data: CreateBeingInput, ownerId: BeingId): Promise<Being>
  async updateBeing(id: BeingId, data: UpdateBeingInput, actorId: BeingId): Promise<Being>
  async getBeing(id: BeingId, actorId?: BeingId): Promise<Being | null>
  async searchBeings(query: SearchBeingsInput, actorId: BeingId): Promise<Being[]>
  async deleteBeing(id: BeingId, actorId: BeingId): Promise<void>
}

// NEW: /src/domain/intention-service.ts  
export class IntentionService {
  async createIntention(data: CreateIntentionInput, actorId: BeingId): Promise<Intention>
  async getIntentions(locationId: BeingId, actorId: BeingId): Promise<Intention[]>
  async updateIntention(id: string, data: UpdateIntentionInput, actorId: BeingId): Promise<Intention>
}
```

#### 1.2 Refactor tRPC Routers
**EDIT:** `/src/server/api/routers/being.ts`
- Move all business logic to BeingService
- Keep only input validation and response formatting
- Remove direct database access

**EDIT:** `/src/server/api/routers/intention.ts`  
- Move all business logic to IntentionService
- Simplify to thin API layer

#### 1.3 Consolidate Authentication
**EDIT:** `/src/server/api/trpc.ts`
- Remove duplicate middleware (lines 132-167)
- Create single `authenticatedProcedure` with consistent auth context
- Extract authorization logic to `/src/domain/auth-service.ts`

**EDIT:** `/src/server/auth/config.ts`
- Move being creation logic to BeingService
- Keep auth callback minimal and focused

### Phase 2: Surface Reduction (Reversible, 2-3 hours)

**Goal:** Eliminate redundant APIs and unnecessary abstractions

#### 2.1 Remove Duplicate REST APIs
**DELETE:** `/src/app/api/beings/route.ts` (entire file, 200+ lines)
**DELETE:** `/src/app/api/intentions/route.ts` (entire file, 150+ lines)
**KEEP:** Only tRPC and `/src/app/api/sync/route.ts` for real-time

#### 2.2 Collapse Hook Hierarchy  
**DELETE:** `/src/hooks/use-simple-sync.ts` (single-call wrapper, 40 lines)
**EDIT:** `/src/hooks/use-beings.ts` 
- Merge functionality from `use-being-cache.ts`
- Direct tRPC calls instead of wrapper hooks

**DELETE:** `/packages/entity-kit/` (entire package)
**INLINE:** EntitySummary and other types into `/src/server/db/types.ts`

#### 2.3 Simplify Authorization Levels
**EDIT:** `/src/server/api/trpc.ts`
- Consolidate `protectedProcedure` and `authorizedProcedure` 
- Single authorization model: session-based with being context

#### 2.4 Unify Modal Patterns
**EDIT:** `/src/app/_components/`
- Standardize on single modal component pattern
- Remove redundant dialog implementations

### Phase 3: Flow Optimization (Requires Testing, 4-5 hours)

**Goal:** Eliminate ping-pong patterns and add temporal safety

#### 3.1 Batch Sync Operations
**EDIT:** `/src/server/lib/simple-sync.ts`
- Debounce rapid location changes (200ms window)
- Batch multiple being updates into single broadcast
- Eliminate redundant sync triggers

#### 3.2 Add Request Deduplication
**NEW:** `/src/lib/deduplication.ts`
```typescript
export class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();
  
  async dedupe<T>(key: string, operation: () => Promise<T>): Promise<T>
}
```

**EDIT:** All mutation operations to use deduplication keys

#### 3.3 Implement Proper Cancellation
**EDIT:** `/src/hooks/use-space-data-context.tsx`
- Add AbortController support for EventSource connections
- Proper cleanup when component unmounts mid-stream

**EDIT:** `/src/server/lib/bots.ts`
- Cancel OpenRouter calls when user navigates away
- Add timeout handling for long-running bot operations

#### 3.4 Fix Temporal Race Conditions
**EDIT:** `/src/hooks/use-space-data-context.tsx`
- Replace global Map mutations with atomic operations
- Add optimistic locking for cache updates

### Phase 4: Type Safety and Testing (2-3 hours)

**Goal:** Eliminate type violations and add temporal determinism

#### 4.1 Fix Recursive Type Issues
**EDIT:** `/src/server/db/types.ts`
- Break circular dependencies in recursive Being/Intention types
- Use forward declarations where needed

#### 4.2 Add Clock Injection
**NEW:** `/src/lib/clock.ts`
```typescript
export interface Clock {
  now(): Date;
}

export const SystemClock: Clock = { now: () => new Date() };
export const TestClock = (date: Date): Clock => ({ now: () => date });
```

**EDIT:** All time-dependent operations to accept Clock parameter

#### 4.3 Contract Consistency
**EDIT:** Ensure BeingId type enforcement at database level
**EDIT:** Align Drizzle schema exactly with Zod validators
**ADD:** Migration strategy for evolving JSONB content structures

---

## Implementation Strategy

### Safe Deployment Approach

Each phase designed to be:
- **Reversible:** Can rollback individual changes
- **Incremental:** Deploy after each phase
- **Backward Compatible:** No breaking API changes during transition

### Validation Steps

After each phase:
1. **Run full test suite:** `npm run test`
2. **Type check:** `npm run typecheck` 
3. **Lint check:** `npm run check`
4. **Build verification:** `npm run test-vercel-build`
5. **Manual smoke test:** Core user flows

### Risk Mitigation

- **Feature flags** for new domain service layer during transition
- **Parallel deployment** of simplified APIs with gradual traffic migration  
- **Rollback plan** with database migration reversals if needed
- **Performance monitoring** to catch regressions early

---

## Expected Outcomes

### Quantified Improvements

**Surface Area Reduction:**
- **-35%** API endpoints (15 → 10 tRPC procedures only)
- **-40%** custom hooks (6 → 3-4 focused hooks)  
- **-500+ lines** removed from unnecessary abstractions
- **-1 package** dependency (entity-kit)

**Boundary Clarity:**
- **Zero** business logic in API route handlers
- **Single** authentication model across all procedures
- **Isolated** domain logic in service layer
- **Consistent** error handling patterns

**Performance Gains:**
- **-50%** redundant sync operations via batching
- **-30%** unnecessary round-trips via deduplication
- **Zero** race conditions via atomic operations
- **Deterministic** temporal behavior via clock injection

### Architectural Benefits

1. **Maintainability:** Clear separation of concerns makes changes predictable
2. **Testability:** Domain services easily unit tested in isolation  
3. **Scalability:** Clean boundaries support independent scaling decisions
4. **Developer Experience:** Simpler mental model, fewer abstraction layers

---

## Future Architecture Vision

### Target End State

```
┌─────────────────┐
│   Presentation  │ ← React components, pure UI logic
├─────────────────┤
│   Application   │ ← tRPC routers, thin API layer  
├─────────────────┤
│     Domain      │ ← Business logic, Being/Intention services
├─────────────────┤
│ Infrastructure  │ ← Database, real-time sync, external APIs
└─────────────────┘
```

### Composable Primitives

- **Being operations:** Create, read, update, delete, search, authorize
- **Intention operations:** Create, read, update, activate-bots
- **Real-time sync:** Subscribe, unsubscribe, broadcast, batch
- **Authentication:** Verify, authorize, create-session, destroy-session

### Minimal Surface Design

- **Single API protocol:** tRPC only (eliminate REST)
- **Single auth model:** Session-based with being context
- **Single sync mechanism:** EventSource with batching
- **Single source of truth:** Database with domain service layer

---

## Migration Timeline

### Week 1: Foundation (Phase 1)
- **Days 1-2:** Create domain service layer
- **Days 3-4:** Refactor tRPC routers to use services
- **Day 5:** Consolidate authentication, deploy Phase 1

### Week 2: Simplification (Phase 2)  
- **Days 1-2:** Remove duplicate REST APIs
- **Days 3-4:** Collapse hook hierarchy and abstractions
- **Day 5:** Unify patterns, deploy Phase 2

### Week 3: Optimization (Phase 3)
- **Days 1-2:** Implement batching and deduplication
- **Days 3-4:** Add cancellation and temporal safety
- **Day 5:** Performance testing, deploy Phase 3

### Week 4: Hardening (Phase 4)
- **Days 1-2:** Fix type system violations
- **Days 3-4:** Add comprehensive testing
- **Day 5:** Final deployment and monitoring

---

## Success Metrics

### Code Quality
- **Zero** boundary violations detected by architectural linter
- **90%+** test coverage on domain service layer
- **Zero** TypeScript `any` types in business logic
- **Zero** console.log statements in production code

### Performance  
- **<100ms** P95 API response times
- **<5** concurrent database connections under normal load
- **<1MB** JavaScript bundle size for core functionality
- **Zero** memory leaks in real-time connections

### Developer Experience
- **<30 seconds** for new developer to understand data flow
- **<5 minutes** to add new being or intention operation
- **<1 hour** to onboard new team member on architecture
- **Zero** "magic" or unexplained abstractions

---

## Architectural Principles Moving Forward

### 1. Boundaries Over Cleverness
- Explicit interfaces better than implicit coupling
- Clear separation of concerns over DRY at all costs
- Simple composition over complex inheritance

### 2. Minimal Surfaces
- Expose only what clients actually need
- One way to do common operations
- Configuration as code, not runtime switches

### 3. Temporal Determinism  
- All time-dependent operations accept clock parameter
- Idempotent operations with deduplication keys
- Proper cancellation for long-running processes

### 4. Composable Primitives
- Small, focused operations that combine naturally
- Single responsibility for each domain service
- Clear data flow from UI to database

---

*This document serves as the architectural north star for rhiz.om development. All future features should align with these principles and contribute to the target end state rather than adding complexity.*

**Next Steps:** Begin Phase 1 implementation with domain service layer extraction.