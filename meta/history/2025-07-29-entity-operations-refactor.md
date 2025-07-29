# Entity Operations Refactor Analysis & Proposal

**Date:** 2025-07-29  
**Author:** Claude Code  
**Status:** Proposal

## Current State Analysis

### Identified Patterns

The codebase currently has significant code duplication across Being and Intention creation/modification operations. Here are the key patterns observed:

#### 1. **Direct Database Operations Pattern** (9+ locations)
- **Beings**: `src/domain/being-service.ts:146-158`, `src/server/auth/config.ts:75`, `src/app/api/auth/dev-login/route.ts:43`
- **Intentions**: `src/domain/intention-service.ts:47-55`, `src/server/lib/bots.ts:95`

Each location manually handles:
```typescript
await this.db.insert(beings/intentions).values({
  ...input,
  modifiedAt: new Date(),
  // id generation, validation, etc.
})
```

#### 2. **Sync Event Broadcasting Pattern** (4+ locations)
- `src/domain/being-service.ts:176-206` (being creation/update sync)
- `src/domain/intention-service.ts:57-62` (intention creation sync)
- `src/server/lib/bots.ts:103` (bot intention sync)

Each manually triggers:
```typescript
broadcastSyncEvent(locationId, {
  type: "being-created" | "intention-created" | "being-updated",
  data: { id },
  timestamp: new Date().toISOString(),
});
```

#### 3. **Metadata Management Pattern** (3+ locations)
- Timestamp handling (`modifiedAt: new Date()`)
- ID generation/validation
- Schema validation with Zod
- Authorization checks (for protected operations)

#### 4. **Side Effect Orchestration** (5+ locations)
- Bot activation: `src/domain/intention-service.ts:64-67`
- Event emissions: `src/domain/being-service.ts:209-216`  
- Cache invalidation (implicit through tRPC)
- Real-time notifications

### Pain Points Identified

1. **Code Duplication**: Same patterns repeated across 15+ locations
2. **Inconsistent Error Handling**: Different error messages and patterns
3. **Missing Operations**: Some locations skip sync events or side effects
4. **Brittle Modifications**: Adding new side effects requires touching multiple files
5. **Testing Complexity**: Each operation needs individual mocking
6. **Type Safety Gaps**: Manual casting between schemas in some locations

## Proposed Refactored Architecture

### Core Abstraction: `being-operations.ts`

Create a simple wrapper that encapsulates the complete pattern of entity operations:

```typescript
// src/lib/being-operations.ts
import type { DrizzleDB } from "~/server/db";
import type { AuthContext } from "~/domain/auth-service";

export async function createBeing(
  db: DrizzleDB,
  input: InsertBeing,
  auth: AuthContext
): Promise<Being> {
  // Handle authorization, database insert, sync notification, side effects
  // All in one place with consistent error handling
}

export async function updateBeing(
  db: DrizzleDB,
  input: UpdateBeingInput,
  auth: AuthContext
): Promise<Being> {
  // Handle authorization, database upsert, sync notifications, side effects
}

export async function createIntention(
  db: DrizzleDB,
  input: CreateIntentionInput,
  auth: AuthContext
): Promise<Intention> {
  // Handle database insert, sync notification, bot activation
}

export async function updateIntention(
  db: DrizzleDB,
  input: UpdateIntentionInput,
  auth: AuthContext
): Promise<Intention> {
  // Handle database update, sync notification
}
```

### Usage Pattern (One-Liners)

```typescript
// In BeingService.upsertBeing():
async upsertBeing(input: InsertBeing, auth: AuthContext): Promise<Being> {
  return await updateBeing(this.db, input, auth);
}

// In IntentionService.createUtterance():
async createUtterance(input: CreateUtteranceInput, auth: AuthContext) {
  const intention = await createIntention(this.db, {
    id: `/${crypto.randomUUID()}`,
    name: `Utterance by ${auth.currentUser?.name ?? "user"}`,
    type: "utterance",
    state: "complete",
    ownerId: auth.sessionBeingId,
    locationId: input.beingId,
    content: [input.content],
  }, auth);
  
  return { success: true };
}

// In bots.ts:
const aiIntention = await createIntention(db, {
  id: aiIntentionId,
  name: `AI Response from ${botId}`,
  type: "utterance",
  state: "active", 
  ownerId: botId,
  locationId: spaceId,
  content: [""],
}, { sessionBeingId: botId, currentUser: null, isCurrentUserSuperuser: false });
```

### Internal Implementation

Each operation handles the complete workflow internally:

1. **Authorization** (when needed)
2. **Database operation** with proper error handling
3. **Sync notifications** using existing `broadcastSyncEvent()`
4. **Side effects** (bot activation, event emission)
5. **Consistent error messages**

## Migration Strategy

### Single Phase: Create and Migrate (Low Risk)
1. **Create `src/lib/being-operations.ts`** with the 4 core functions
2. **Migrate `BeingService.upsertBeing()`** - becomes a one-liner
3. **Migrate `IntentionService.createUtterance()`** - becomes a one-liner  
4. **Migrate bot operations** (`src/server/lib/bots.ts`) - simplified
5. **Migrate auth operations** (`src/server/auth/config.ts`, dev login) - optional
6. **Add tests** - much simpler since all logic is centralized

### What Gets Eliminated
- 15+ locations with duplicate database insert patterns
- 4+ locations with duplicate sync event broadcasting  
- Inconsistent error handling across operations
- Manual timestamp and metadata management

## Benefits

### Developer Experience  
- **One-Liner Operations**: Creating/updating entities becomes a single function call
- **No More Boilerplate**: No need to remember all the steps (auth, db, sync, side effects)
- **Consistent Patterns**: Same signature for all operations
- **Better Testing**: Mock one function instead of multiple database/sync calls

### Maintainability
- **90% Less Duplication**: All common patterns centralized in one file
- **Single Source of Truth**: All entity operations go through 4 functions
- **Consistent Error Handling**: Same error patterns across all operations
- **Easy to Extend**: Add new side effects in one place

### Simplicity
- **No Complex Abstractions**: Just 4 simple functions in one file
- **Normal TypeScript**: No frameworks, pipelines, or unusual patterns
- **Easy to Understand**: Any developer can read and modify the operations

## Implementation Estimate

**Total Time**: ~1-2 days

1. **Create `being-operations.ts`** (2-3 hours)
   - Write 4 functions with proper error handling
   - Include all existing authorization and sync logic
   
2. **Migrate services** (3-4 hours)
   - Update `BeingService.upsertBeing()` to one-liner
   - Update `IntentionService.createUtterance()` to one-liner
   - Update bot operations in `bots.ts`
   
3. **Test and verify** (2-3 hours)
   - Ensure all existing functionality works
   - Add tests for the 4 core functions
   - Verify real-time sync still works

## Risk Assessment

**Very Low Risk** - This is a simple extraction refactor:
- New functions use exact same logic as existing code
- No architectural changes or complex abstractions  
- Can be done incrementally (migrate one service at a time)
- Easy to rollback if needed

## Buddhist Reflection

*"Just as a carpenter uses many tools to craft fine furniture, yet keeps them organized in their proper place, so too should we organize our code patterns to serve clarity and reduce the suffering of future modifications."*

---

This refactor follows the principle of **Right Action** in software development - reducing duplication, improving maintainability, and creating a foundation that serves both current needs and future growth.