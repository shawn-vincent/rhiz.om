
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start Next.js development server with Turbo
- `npm run test-vercel-build` - Run a simulated production build as though it were running on Vercel.  Really helpful to do pre-commit.
- `npm run start` - Start production server
- `npm run preview` - Build and start production server

### Code Quality
- `npm run check` - Run Biome linter and formatter checks
- `npm run check:write` - Run Biome with auto-fix
- `npm run check:unsafe` - Run Biome with unsafe auto-fixes
- `npm run typecheck` - Run TypeScript type checking

### Database
- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:migrate` - Apply migrations to database
- `npm run db:push` - Push schema changes directly to database
- `npm run db:studio` - Open Drizzle Studio database GUI

## Architecture Overview

This is a T3 Stack application with custom entity-based architecture:

### Core Stack
- **Next.js 15** with App Router and React 19
- **tRPC** for type-safe API layer with TanStack Query
- **Drizzle ORM** with PostgreSQL database
- **NextAuth.js 5.0.0-beta.25** for Google OAuth authentication
- **Tailwind CSS 4.0** with design system
- **shadcn/ui** component library built on Radix UI
- **Biome** for linting, formatting, and code quality
- **TypeScript 5.8** with strict configuration

### Entity System
The application uses a unique "Being/Intention" data model:

- **Beings** - Core entities representing users, spaces, documents (types: guest, space, document)
- **Intentions** - Actions/verbs like chat messages, errors with lifecycle state tracking
- Both stored in PostgreSQL with JSON content fields and rich metadata support
- Drizzle schema with type-safe validation using Zod

### Key Directories
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - Reusable UI components built with shadcn/ui and Radix primitives
- `src/server/` - Backend logic (tRPC routers, auth config, database schema)
- `src/trpc/` - Client-side tRPC configuration with TanStack Query
- `src/hooks/` - Custom React hooks for data fetching and state management
- `src/lib/` - Utility functions, contexts, and shared logic
- `packages/` - Shared packages (currently contains entity-kit types)

### Database Schema
- Multi-project schema with `rhiz.om_` table prefix using Drizzle's `pgTableCreator`
- Core tables: `beings`, `intentions`, plus NextAuth.js tables (`users`, `accounts`, `sessions`)
- Rich JSONB content fields with metadata, properties, and content storage
- Self-referential relationships for ownership and location hierarchies
- Indexed for performance with owner and location lookups

### Authentication Flow
- Google OAuth via NextAuth.js 5.0 beta with Drizzle adapter
- Users linked to Being entities via `beingId` foreign key
- tRPC protected procedures verify session and being ownership
- JWT sessions with secure cookie handling

## Environment Variables
Required environment variables (see `src/env.js`):
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - NextAuth secret
- `AUTH_GOOGLE_ID` & `AUTH_GOOGLE_SECRET` - Google OAuth
- `OPENROUTER_API_KEY` - LLM API access

## Development Workflow

### Code Quality
- **Biome** handles linting, formatting, and import organization
- **TypeScript** with strict mode and comprehensive type checking
- Always run `npm run check` and `npm run typecheck` before committing changes
- Biome config includes Tailwind class sorting and safe auto-fixes

### Component Architecture
- **shadcn/ui** components in `src/components/ui/` provide design system foundation
- Custom components build on Radix UI primitives for accessibility
- Tailwind CSS 4.0 with design tokens and utility classes
- Error boundaries and proper loading states throughout the application

### Data Flow
- **tRPC** provides end-to-end type safety from database to frontend
- **TanStack Query** handles caching, background updates, and optimistic updates
- **Drizzle** ORM with compile-time SQL validation and migrations
- **Zod** schemas for runtime validation and type generation

## Commits
When committing: Use emoji, detailed descriptions, and end with Buddhist Sutta quotes relating to the change content. Identity: Shawn Vincent, svincent@svincent.com.
