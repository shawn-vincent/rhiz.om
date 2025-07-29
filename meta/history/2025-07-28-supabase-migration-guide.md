# Rhiz.om Supabase Migration Guide

**Date:** 2025-07-28  
**Author:** Claude Code  
**Purpose:** Complete guide to recreate rhiz.om application using Supabase instead of Vercel + tRPC + Drizzle

## Executive Summary

This document outlines the complete migration from the current T3 Stack + Vercel deployment to a Supabase-powered architecture. The migration addresses the core issue: **Vercel's serverless functions cannot support real-time cross-user communication** due to in-memory state isolation between function instances.

### Key Benefits of Migration
- **Real-time chat that actually works cross-user**
- **Free hosting with Supabase's generous free tier**
- **Local development with full feature parity**
- **Built-in auth, database, storage, and real-time subscriptions**
- **Simplified architecture with fewer moving parts**

## Current Architecture Analysis

### Technology Stack
- **Next.js 15** with App Router and React 19
- **tRPC** for type-safe API layer with TanStack Query
- **Drizzle ORM** with PostgreSQL database
- **NextAuth.js 5.0.0-beta.25** for Google OAuth authentication
- **Custom sync system** using Server-Sent Events (broken on Vercel)
- **Tailwind CSS 4.0** with shadcn/ui components
- **Vercel deployment** (the problematic part)

### Core Data Model
The application uses a unique "Being/Intention" entity system:

#### Beings Table
```sql
CREATE TABLE rhiz_om_beings (
  id VARCHAR(255) PRIMARY KEY,           -- e.g., @shawn-vincent, @some-space
  name VARCHAR(256) NOT NULL,
  type VARCHAR(50) NOT NULL,             -- 'guest', 'space', 'document'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  owner_id VARCHAR(255) REFERENCES rhiz_om_beings(id),
  location_id VARCHAR(255) REFERENCES rhiz_om_beings(id),
  ext_ids JSONB,                         -- External provider IDs
  id_history JSONB,                      -- Historical IDs
  metadata JSONB,
  properties JSONB,
  content JSONB,
  -- Bot-specific fields
  bot_model VARCHAR(255),
  bot_prompt TEXT,
  llm_api_key TEXT
);
```

#### Intentions Table
```sql
CREATE TABLE rhiz_om_intentions (
  id VARCHAR(255) PRIMARY KEY,           -- e.g., /msg-abcde
  name VARCHAR(256) NOT NULL,
  type VARCHAR(50) NOT NULL,             -- 'utterance', 'error'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  owner_id VARCHAR(255) NOT NULL REFERENCES rhiz_om_beings(id),
  location_id VARCHAR(255) NOT NULL REFERENCES rhiz_om_beings(id),
  state VARCHAR(50) NOT NULL,            -- 'draft', 'active', 'paused', 'complete', 'cancelled', 'failed'
  content JSONB NOT NULL
);
```

### Current Authentication Flow
1. Google OAuth via NextAuth.js
2. User records linked to Being entities via `beingId` foreign key
3. tRPC protected procedures verify session and being ownership
4. JWT sessions with secure cookie handling

### Broken Real-time System
- Uses Server-Sent Events with in-memory connection tracking
- Event emitters and connection maps are per-function instance
- Cross-user updates fail because User A and User B connect to different serverless function instances
- Delta batching and broadcasting only work within single function instance

## Supabase Architecture Design

### Technology Stack Migration
| Current | Supabase Equivalent | Notes |
|---------|-------------------|-------|
| Drizzle ORM | Supabase SDK | Direct PostgreSQL with type generation |
| NextAuth.js | Supabase Auth | Built-in Google OAuth support |
| tRPC | Supabase Client | Type-safe database operations |
| Custom SSE sync | Supabase Realtime | Built-in PostgreSQL change subscriptions |
| Vercel Functions | Supabase Edge Functions | For custom server logic |
| Manual database | Supabase Database | Managed PostgreSQL with GUI |

### Database Schema Translation

#### Supabase Schema Setup
```sql
-- Enable real-time for tables
ALTER publication supabase_realtime ADD TABLE beings;
ALTER publication supabase_realtime ADD TABLE intentions;

-- Enable Row Level Security
ALTER TABLE beings ENABLE ROW LEVEL SECURITY;
ALTER TABLE intentions ENABLE ROW LEVEL SECURITY;

-- Create beings table (simplified, no prefix needed)
CREATE TABLE beings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  owner_id TEXT REFERENCES beings(id),
  location_id TEXT REFERENCES beings(id),
  ext_ids JSONB,
  id_history JSONB,
  metadata JSONB,
  properties JSONB,
  content JSONB,
  -- Bot fields
  bot_model TEXT,
  bot_prompt TEXT,
  llm_api_key TEXT
);

-- Create intentions table
CREATE TABLE intentions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  owner_id TEXT NOT NULL REFERENCES beings(id),
  location_id TEXT NOT NULL REFERENCES beings(id),
  state TEXT NOT NULL CHECK (state IN ('draft', 'active', 'paused', 'complete', 'cancelled', 'failed')),
  content JSONB NOT NULL
);

-- Indexes for performance
CREATE INDEX beings_owner_idx ON beings(owner_id);
CREATE INDEX beings_location_idx ON beings(location_id);
CREATE INDEX beings_type_idx ON beings(type);
CREATE INDEX intentions_owner_idx ON intentions(owner_id);
CREATE INDEX intentions_location_idx ON intentions(location_id);
CREATE INDEX intentions_created_idx ON intentions(created_at);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_modified_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER beings_modified_at
  BEFORE UPDATE ON beings
  FOR EACH ROW EXECUTE FUNCTION update_modified_at();

CREATE TRIGGER intentions_modified_at
  BEFORE UPDATE ON intentions
  FOR EACH ROW EXECUTE FUNCTION update_modified_at();
```

#### Row Level Security Policies
```sql
-- Beings policies
CREATE POLICY "Users can view beings they own or are located in"
  ON beings FOR SELECT
  USING (
    owner_id = auth.jwt() ->> 'sub' OR
    location_id IN (
      SELECT id FROM beings 
      WHERE owner_id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can create beings they own"
  ON beings FOR INSERT
  WITH CHECK (owner_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update beings they own"
  ON beings FOR UPDATE
  USING (owner_id = auth.jwt() ->> 'sub');

-- Intentions policies
CREATE POLICY "Users can view intentions in spaces they own or participate in"
  ON intentions FOR SELECT
  USING (
    owner_id = auth.jwt() ->> 'sub' OR
    location_id IN (
      SELECT id FROM beings 
      WHERE owner_id = auth.jwt() ->> 'sub' OR 
            location_id IN (SELECT id FROM beings WHERE owner_id = auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Users can create intentions they own"
  ON intentions FOR INSERT
  WITH CHECK (owner_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update intentions they own"
  ON intentions FOR UPDATE
  USING (owner_id = auth.jwt() ->> 'sub');
```

### Authentication Migration

#### Current NextAuth.js Setup
```typescript
// Current auth configuration
export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GoogleProvider({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  // Custom session handling with beingId
}
```

#### Supabase Auth Equivalent
```typescript
// supabase/config.toml
[auth]
enabled = true
site_url = "http://localhost:3000"

[auth.external.google]
enabled = true
client_id = "your-google-client-id"
secret = "your-google-client-secret"
redirect_uri = "http://localhost:54321/auth/v1/callback"

// Client-side auth
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Sign in with Google
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
})

// Get current user
const { data: { user } } = await supabase.auth.getUser()
```

### Real-time System Migration

#### Current Broken SSE System
```typescript
// Current broken approach - in-memory state per function
const connections = new Map<string, Connection>(); // ❌ Per-function instance
const deltaBuffers = new Map<string, DeltaBuffer>(); // ❌ Not shared

// Only works within single serverless function
function broadcastDelta(spaceId: string, delta: SyncEvent) {
  for (const [connectionId, connection] of connections) { // ❌ Limited scope
    if (connection.spaceId === spaceId) {
      sendToConnection(connectionId, delta);
    }
  }
}
```

#### Supabase Real-time Solution
```typescript
// ✅ Built-in cross-user real-time that actually works
const supabase = createClient(url, key)

// Subscribe to chat messages in a space
supabase
  .channel(`space:${spaceId}`)
  .on('postgres_changes', 
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'intentions',
      filter: `location_id=eq.${spaceId}`
    },
    (payload) => {
      // ✅ All users in this space receive this update
      console.log('New message:', payload.new)
      addMessageToUI(payload.new)
    }
  )
  .subscribe()

// Send message (triggers real-time update for all subscribers)
const { data, error } = await supabase
  .from('intentions')
  .insert({
    id: `/msg-${crypto.randomUUID()}`,
    name: `Message from ${user.name}`,
    type: 'utterance',
    owner_id: user.id,
    location_id: spaceId,
    state: 'complete',
    content: { text: messageContent }
  })
```

## Step-by-Step Migration Plan

### Phase 1: Local Development Setup

#### 1.1 Install Supabase CLI
```bash
# Install Supabase CLI on Mac
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

#### 1.2 Initialize New Supabase Project
```bash
# Create new project directory
mkdir rhiz-om-supabase
cd rhiz-om-supabase

# Initialize Supabase
supabase init

# Start local development stack
supabase start
```

This provides:
- **API URL:** `http://localhost:54321`
- **DB URL:** `postgresql://postgres:postgres@localhost:54322/postgres`
- **Studio URL:** `http://localhost:54323`
- **Real-time URL:** `ws://localhost:54321/realtime/v1/websocket`

#### 1.3 Create Next.js Application
```bash
# Create Next.js 15 app with TypeScript
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Install Supabase dependencies
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs

# Install UI dependencies (keeping current design system)
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label
npm install @radix-ui/react-popover @radix-ui/react-scroll-area @radix-ui/react-select
npm install @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-toggle
npm install @radix-ui/react-tooltip class-variance-authority clsx
npm install cmdk lucide-react tailwind-merge tailwindcss-animate sonner
npm install react-markdown rehype-raw rehype-sanitize remark-gfm
npm install @codemirror/lang-json @codemirror/lang-markdown @codemirror/theme-one-dark
npm install @uiw/react-codemirror @uiw/codemirror-themes
npm install uuid zod superjson next-themes next-pwa

# Development dependencies
npm install -D @types/uuid @biomejs/biome
```

#### 1.4 Environment Configuration
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase-start

# For production (later)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter API (if keeping AI features)
OPENROUTER_API_KEY=your-openrouter-key
```

### Phase 2: Database Migration

#### 2.1 Create Database Schema
```sql
-- Run in Supabase Studio SQL Editor or via supabase db reset

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create beings table
CREATE TABLE beings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('guest', 'space', 'document', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  owner_id TEXT REFERENCES beings(id),
  location_id TEXT REFERENCES beings(id),
  ext_ids JSONB DEFAULT '[]'::jsonb,
  id_history JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  properties JSONB DEFAULT '{}'::jsonb,
  content JSONB DEFAULT '{}'::jsonb,
  bot_model TEXT,
  bot_prompt TEXT,
  llm_api_key TEXT
);

-- Create intentions table
CREATE TABLE intentions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('utterance', 'error', 'bot_response')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  owner_id TEXT NOT NULL REFERENCES beings(id),
  location_id TEXT NOT NULL REFERENCES beings(id),
  state TEXT NOT NULL CHECK (state IN ('draft', 'active', 'paused', 'complete', 'cancelled', 'failed')),
  content JSONB NOT NULL
);

-- Create indexes
CREATE INDEX beings_owner_idx ON beings(owner_id);
CREATE INDEX beings_location_idx ON beings(location_id);
CREATE INDEX beings_type_idx ON beings(type);
CREATE INDEX intentions_owner_idx ON intentions(owner_id);
CREATE INDEX intentions_location_idx ON intentions(location_id);
CREATE INDEX intentions_created_idx ON intentions(created_at);
CREATE INDEX intentions_location_created_idx ON intentions(location_id, created_at);

-- Enable real-time
ALTER publication supabase_realtime ADD TABLE beings;
ALTER publication supabase_realtime ADD TABLE intentions;

-- Row Level Security
ALTER TABLE beings ENABLE ROW LEVEL SECURITY;
ALTER TABLE intentions ENABLE ROW LEVEL SECURITY;

-- Update triggers
CREATE OR REPLACE FUNCTION update_modified_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER beings_modified_at
  BEFORE UPDATE ON beings
  FOR EACH ROW EXECUTE FUNCTION update_modified_at();

CREATE TRIGGER intentions_modified_at
  BEFORE UPDATE ON intentions
  FOR EACH ROW EXECUTE FUNCTION update_modified_at();
```

#### 2.2 Data Migration Scripts
```typescript
// scripts/migrate-data.ts
import { createClient } from '@supabase/supabase-js'
import { drizzleClient } from '../src/server/db' // Current Drizzle setup

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function migrateBeings() {
  // Fetch all beings from current database
  const currentBeings = await drizzleClient.query.beings.findMany()
  
  // Transform and insert into Supabase
  for (const being of currentBeings) {
    const { error } = await supabase.from('beings').insert({
      id: being.id,
      name: being.name,
      type: being.type,
      created_at: being.createdAt,
      modified_at: being.modifiedAt,
      owner_id: being.ownerId,
      location_id: being.locationId,
      ext_ids: being.extIds,
      id_history: being.idHistory,
      metadata: being.metadata,
      properties: being.properties,
      content: being.content,
      bot_model: being.botModel,
      bot_prompt: being.botPrompt,
      llm_api_key: being.llmApiKey
    })
    
    if (error) {
      console.error('Error migrating being:', being.id, error)
    } else {
      console.log('Migrated being:', being.id)
    }
  }
}

async function migrateIntentions() {
  // Similar process for intentions
  const currentIntentions = await drizzleClient.query.intentions.findMany()
  
  for (const intention of currentIntentions) {
    const { error } = await supabase.from('intentions').insert({
      id: intention.id,
      name: intention.name,
      type: intention.type,
      created_at: intention.createdAt,
      modified_at: intention.modifiedAt,
      owner_id: intention.ownerId,
      location_id: intention.locationId,
      state: intention.state,
      content: intention.content
    })
    
    if (error) {
      console.error('Error migrating intention:', intention.id, error)
    } else {
      console.log('Migrated intention:', intention.id)
    }
  }
}

// Run migration
async function runMigration() {
  await migrateBeings()
  await migrateIntentions()
  console.log('Migration complete')
}

runMigration().catch(console.error)
```

### Phase 3: Authentication Implementation

#### 3.1 Supabase Auth Setup
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Generate types with: supabase gen types typescript --local > lib/database.types.ts
```

#### 3.2 Auth Context Provider
```typescript
// contexts/auth-context.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  beingId: string | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [beingId, setBeingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        findOrCreateBeing(session.user)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await findOrCreateBeing(session.user)
        } else {
          setBeingId(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const findOrCreateBeing = async (user: User) => {
    // Look for existing being linked to this user
    let { data: being, error } = await supabase
      .from('beings')
      .select('id')
      .eq('ext_ids', JSON.stringify([{ provider: 'supabase', id: user.id }]))
      .single()

    if (error && error.code === 'PGRST116') {
      // Being doesn't exist, create it
      const newBeingId = `@${user.email?.split('@')[0] || user.id}`
      
      const { data: newBeing, error: createError } = await supabase
        .from('beings')
        .insert({
          id: newBeingId,
          name: user.user_metadata?.full_name || user.email || 'User',
          type: 'user',
          owner_id: newBeingId, // Self-owned
          ext_ids: [{ provider: 'supabase', id: user.id }],
          metadata: {
            email: user.email,
            avatar_url: user.user_metadata?.avatar_url
          }
        })
        .select('id')
        .single()

      if (createError) {
        console.error('Error creating being:', createError)
        return
      }
      
      being = newBeing
    }

    setBeingId(being?.id || null)
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user,
      beingId,
      loading,
      signInWithGoogle,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

#### 3.3 Auth Callback Route
```typescript
// app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(requestUrl.origin)
}
```

### Phase 4: Real-time Chat Implementation

#### 4.1 Chat Hook with Real-time Subscriptions
```typescript
// hooks/use-chat.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'

interface ChatMessage {
  id: string
  name: string
  type: string
  created_at: string
  owner_id: string
  location_id: string
  content: { text: string }
}

export function useChat(spaceId: string) {
  const { user, beingId } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!spaceId) return

    // Fetch initial messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('intentions')
        .select('*')
        .eq('location_id', spaceId)
        .eq('type', 'utterance')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching messages:', error)
      } else {
        setMessages(data || [])
      }
      setLoading(false)
    }

    fetchMessages()

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat:${spaceId}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'intentions',
          filter: `location_id=eq.${spaceId} AND type=eq.utterance`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage
          setMessages(prev => [...prev, newMessage])
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'intentions',
          filter: `location_id=eq.${spaceId} AND type=eq.utterance`
        },
        (payload) => {
          const updatedMessage = payload.new as ChatMessage
          setMessages(prev => 
            prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [spaceId])

  const sendMessage = async (content: string) => {
    if (!beingId || !content.trim()) return

    const messageId = `/msg-${crypto.randomUUID()}`
    
    const { error } = await supabase
      .from('intentions')
      .insert({
        id: messageId,
        name: `Message from ${user?.user_metadata?.full_name || 'User'}`,
        type: 'utterance',
        owner_id: beingId,
        location_id: spaceId,
        state: 'complete',
        content: { text: content }
      })

    if (error) {
      console.error('Error sending message:', error)
    }
  }

  return {
    messages,
    loading,
    sendMessage
  }
}
```

#### 4.2 Chat Component
```typescript
// components/chat.tsx
'use client'

import { useState } from 'react'
import { useChat } from '@/hooks/use-chat'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ChatProps {
  spaceId: string
}

export function Chat({ spaceId }: ChatProps) {
  const { user } = useAuth()
  const { messages, loading, sendMessage } = useChat(spaceId)
  const [input, setInput] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    await sendMessage(input)
    setInput('')
  }

  if (loading) return <div>Loading chat...</div>

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="flex flex-col space-y-1">
              <div className="text-sm text-muted-foreground">
                {message.name} • {new Date(message.created_at).toLocaleTimeString()}
              </div>
              <div className="text-sm">
                {message.content.text}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <form onSubmit={handleSubmit} className="flex space-x-2 p-4 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button type="submit" disabled={!input.trim()}>
          Send
        </Button>
      </form>
    </div>
  )
}
```

### Phase 5: Space Management

#### 5.1 Space Hook
```typescript
// hooks/use-spaces.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'

interface Space {
  id: string
  name: string
  type: string
  created_at: string
  owner_id: string
  content: any
}

export function useSpaces() {
  const { beingId } = useAuth()
  const [spaces, setSpaces] = useState<Space[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!beingId) return

    const fetchSpaces = async () => {
      const { data, error } = await supabase
        .from('beings')
        .select('*')
        .eq('type', 'space')
        .eq('owner_id', beingId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching spaces:', error)
      } else {
        setSpaces(data || [])
      }
      setLoading(false)
    }

    fetchSpaces()

    // Subscribe to space changes
    const channel = supabase
      .channel(`spaces:${beingId}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'beings',
          filter: `type=eq.space AND owner_id=eq.${beingId}`
        },
        () => {
          fetchSpaces() // Refetch on any change
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [beingId])

  const createSpace = async (name: string) => {
    if (!beingId) return null

    const spaceId = `@${name.toLowerCase().replace(/\s+/g, '-')}`
    
    const { data, error } = await supabase
      .from('beings')
      .insert({
        id: spaceId,
        name,
        type: 'space',
        owner_id: beingId,
        location_id: beingId,
        content: { description: '' }
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating space:', error)
      return null
    }

    return data
  }

  return {
    spaces,
    loading,
    createSpace
  }
}
```

### Phase 6: Bot Integration

#### 6.1 Bot Response Handler
```typescript
// lib/bot-handler.ts
import { supabase } from '@/lib/supabase'

interface BotConfig {
  id: string
  name: string
  bot_model: string
  bot_prompt: string
  llm_api_key?: string
}

export async function triggerBots(spaceId: string, messageId: string) {
  // Find all bots in the space
  const { data: bots, error } = await supabase
    .from('beings')
    .select('*')
    .eq('location_id', spaceId)
    .eq('type', 'guest')
    .not('bot_model', 'is', null)

  if (error || !bots?.length) return

  // Process each bot
  for (const bot of bots) {
    await processBotResponse(bot, spaceId, messageId)
  }
}

async function processBotResponse(bot: BotConfig, spaceId: string, triggerMessageId: string) {
  try {
    // Get recent conversation history
    const { data: recentMessages } = await supabase
      .from('intentions')
      .select('*')
      .eq('location_id', spaceId)
      .eq('type', 'utterance')
      .order('created_at', { ascending: false })
      .limit(10)

    if (!recentMessages?.length) return

    // Build conversation context
    const conversation = recentMessages
      .reverse()
      .map(msg => `${msg.name}: ${msg.content.text}`)
      .join('\n')

    // Call LLM API (OpenRouter example)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bot.llm_api_key || process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: bot.bot_model,
        messages: [
          { role: 'system', content: bot.bot_prompt },
          { role: 'user', content: conversation }
        ]
      })
    })

    const result = await response.json()
    const botReply = result.choices?.[0]?.message?.content

    if (botReply) {
      // Post bot response
      await supabase
        .from('intentions')
        .insert({
          id: `/bot-${crypto.randomUUID()}`,
          name: `Response from ${bot.name}`,
          type: 'utterance',
          owner_id: bot.id,
          location_id: spaceId,
          state: 'complete',
          content: { text: botReply }
        })
    }
  } catch (error) {
    console.error('Bot processing error:', error)
  }
}
```

#### 6.2 Bot Trigger via Edge Function
```typescript
// supabase/functions/bot-trigger/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { record } = await req.json()
    
    // Only trigger on new utterances
    if (record.type !== 'utterance') {
      return new Response('OK', { status: 200 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Find bots in the space
    const { data: bots } = await supabase
      .from('beings')
      .select('*')
      .eq('location_id', record.location_id)
      .eq('type', 'guest')
      .not('bot_model', 'is', null)

    // Process each bot (simplified)
    for (const bot of bots || []) {
      // Bot processing logic here
      // Similar to the client-side version but running on edge
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

### Phase 7: Production Deployment

#### 7.1 Create Production Supabase Project
```bash
# Create new project at https://supabase.com
# Note down:
# - Project URL: https://your-project.supabase.co
# - Anon public key
# - Service role key (secret)

# Link local project to remote
supabase link --project-ref your-project-ref

# Push local schema to production
supabase db push

# Deploy edge functions
supabase functions deploy bot-trigger
```

#### 7.2 Configure Google OAuth for Production
```bash
# In Supabase Dashboard > Authentication > Providers > Google
# Add your production domain to authorized origins:
# - https://your-app.vercel.app
# - https://your-project.supabase.co

# Update Google OAuth settings:
# Authorized JavaScript origins: https://your-app.vercel.app
# Authorized redirect URIs: https://your-project.supabase.co/auth/v1/callback
```

#### 7.3 Deploy to Vercel (or Alternative)
```bash
# Production environment variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret
OPENROUTER_API_KEY=your-openrouter-key

# Deploy
npm run build
vercel --prod

# Or deploy to alternative hosting:
# - Railway: railway up
# - Fly.io: fly deploy
# - Render: Connected via Git
```

#### 7.4 Alternative Free Hosting Options

**Railway (Recommended)**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

**Fly.io**
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly deploy
```

**Render**
```bash
# Connect GitHub repo in Render dashboard
# Automatic deployments on push
# Free tier includes:
# - 750 hours/month
# - Sleeps after 15min inactivity
# - Custom domains
```

## Local Development Workflow

### Daily Development Commands
```bash
# Start Supabase services
supabase start

# Start Next.js development
npm run dev

# Access local services:
# - App: http://localhost:3000
# - Supabase Studio: http://localhost:54323
# - Database: postgresql://postgres:postgres@localhost:54322/postgres

# Make database changes
# 1. Update schema in Supabase Studio
# 2. Generate migration:
supabase db diff --file new_migration
# 3. Apply to local:
supabase db reset
# 4. Later push to production:
supabase db push
```

### Testing Real-time Features
```bash
# Open multiple browser tabs to same space
# Send messages from different tabs
# Verify all tabs receive messages instantly
# Test with different users (incognito mode)

# Monitor real-time subscriptions
# In browser dev tools, watch Network tab for WebSocket connections
# Should see: ws://localhost:54321/realtime/v1/websocket
```

## Migration Benefits Summary

### Technical Benefits
- ✅ **Real-time chat that actually works cross-user**
- ✅ **No complex serverless function state management**
- ✅ **Built-in authentication with Google OAuth**
- ✅ **Automatic database management and migrations**
- ✅ **Type-safe database operations**
- ✅ **Local development with full feature parity**
- ✅ **Built-in file storage for future features**
- ✅ **Edge functions for custom server logic**
- ✅ **Row Level Security for data protection**

### Cost Benefits
- ✅ **Free Supabase tier: 2 projects, 500MB database, 2GB bandwidth**
- ✅ **Free hosting options: Railway, Fly.io, Render**
- ✅ **No Vercel function execution costs**
- ✅ **No external Redis or message broker costs**

### Development Benefits
- ✅ **Simplified architecture with fewer dependencies**
- ✅ **Local development matches production exactly**
- ✅ **Built-in database GUI (Supabase Studio)**
- ✅ **Automatic API generation from database schema**
- ✅ **Built-in user management and auth flows**
- ✅ **Real-time subscriptions work out of the box**

### Maintenance Benefits
- ✅ **Fewer services to maintain and monitor**
- ✅ **Automatic database backups**
- ✅ **Built-in metrics and logging**
- ✅ **Automatic SSL certificates**
- ✅ **CDN included**

## Potential Challenges and Solutions

### Data Migration
**Challenge:** Migrating existing user data and chat history  
**Solution:** Use the provided migration scripts and test thoroughly in staging

### Authentication Migration
**Challenge:** Users need to re-authenticate  
**Solution:** Communicate migration timeline, provide clear instructions

### Bot Integration
**Challenge:** Migrating existing bot configurations  
**Solution:** Export bot settings and recreate in new system, test thoroughly

### Real-time Performance
**Challenge:** Ensuring real-time performance at scale  
**Solution:** Supabase handles this automatically, monitor usage and upgrade plan if needed

## Timeline Estimate

- **Phase 1 (Local Setup):** 1-2 days
- **Phase 2 (Database Migration):** 2-3 days  
- **Phase 3 (Authentication):** 1-2 days
- **Phase 4 (Real-time Chat):** 2-3 days
- **Phase 5 (Space Management):** 1-2 days
- **Phase 6 (Bot Integration):** 2-3 days
- **Phase 7 (Production Deploy):** 1-2 days

**Total: 10-17 days** depending on complexity of current customizations

## Next Steps

1. **Test Supabase locally** with the provided setup instructions
2. **Create a minimal chat proof-of-concept** to verify real-time works
3. **Plan the migration timeline** based on user activity patterns
4. **Set up production Supabase project** 
5. **Begin incremental migration** starting with database schema

This migration addresses the core issue with your current architecture while providing a more maintainable, scalable, and cost-effective solution for real-time chat functionality.