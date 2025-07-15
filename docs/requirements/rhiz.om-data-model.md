# Rhiz.om Data Model

```ts
/*──────────────────────── identifiers ────────────────────────*/

/** A Being’s canonical identifier.  
 *  `@` → noun (Being or Intention-as-Being)  
 *  `/` → verb (Intention only)
 */
export type BeingId = `@${string}` | `/${string}`;

/** An Intention’s identifier – **always** begins with `/`. */
export type IntentionId = `/${string}`;

/*──────────────────── supporting structures ───────────────────*/

/** Link to the same logical entity in an external system. */
export type ExtId = {
  provider: string;
  id: string;
};

/** Rich, recursively-nestable content tree. */
export type ContentNode =
  | string
  | ContentDataIsland;

export type DataIslandType = 'error'; // more over time.

/*
 Structured data island: gets rendered as pill by default.
 If has content, gets rendered using some nestable clear highlighting by default.
 Specific types may have specific renderers.
*/
export interface ContentDataIsland {
  type: string;
  props?: Record<string, any>;
  content?: ContentNode[];
}

/*────────────────────────── BEING (noun) ──────────────────────────*/

/** Root entity for *anything* that inhabits Two Trees.  
 *  Typical kinds are `guest`, `space`, and `document`.  
 *  Verbs (Intentions) reuse this shape but add a `state`.
 */
export interface Being {
  /** Human-readable ID (`@…` or `/…`). */
  id: BeingId;

  /** Display label. */
  name: string;

  /** Semantic subtype. */
  type: 'guest' | 'space' | 'document';

  /** Creation timestamp (ISO-8601, UTC). */
  createdAt: string;

  /** Last modification timestamp (ISO-8601, UTC). */
  modifiedAt: string;

  /** Controlling Being (often self). */
  owner: BeingId;

  /** Parent/context Being that contains this record. */
  location: BeingId;

  /** Same entity represented in other systems. */
  extIds?: ExtId[];

  /** Previous IDs (renames, merges). */
  idHistory?: BeingId[];

  /** Factual attributes that may evolve. */
  metadata?: Record<string, any>;

  /** Domain-specific values. */
  properties?: Record<string, any>;

  /** Mixed-media body. */
  content: ContentNode[];
}

/*──────────────────────── INTENTION (verb) ────────────────────────*/

/** Action-oriented Being.  
 *  IDs always start with `/` and lifecycle is tracked via `state`. */
export interface Intention extends Being {
  /** Identifier must start with `/`. */
  id: IntentionId;

  /** Bounded verb kinds. */
  type: 'utterance' | 'error';

  /** Lifecycle status. */
  state:
    | 'draft'
    | 'active'
    | 'paused'
    | 'complete'
    | 'cancelled'
    | 'failed';

  /** History narrowed to Intention IDs. */
  idHistory?: IntentionId[];
}

/*───────────────────────── example instances ──────────────────────*/

/* 1. Transient guest user (Soulscapes-toned alias) */
export const guest: Being = {
  id: '@luminous-dawn',
  name: 'Luminous Dawn',
  type: 'guest',
  createdAt: '2025-07-12T12:00:00Z',
  modifiedAt: '2025-07-12T12:00:00Z',

  owner: '@luminous-dawn',
  location: '@two-trees-lobby',

  metadata: { presence: 'online' },
  content: ['🌿 Welcome to Two Trees!']
};

/* 2. Community space for holistic practice */
export const space: Being = {
  id: '@two-trees-community',
  name: 'Two Trees Community Circle',
  type: 'space',
  createdAt: '2025-06-20T15:22:10Z',
  modifiedAt: '2025-07-10T09:13:45Z',

  owner: '@forest-keeper',
  location: '@root',

  extIds: [{ provider: 'forum', id: 'two-trees-circle' }],
  content: []
};

/* 3. Living document: Breathwork Guide */
export const doc: Being = {
  id: '@breathwork-guide',
  name: 'Introductory Breathwork Guide',
  type: 'document',
  createdAt: '2025-05-07T09:41:22Z',
  modifiedAt: '2025-07-08T18:22:03Z',

  owner: '@two-trees-community',
  location: '@two-trees-community',

  properties: { mimeType: 'text/markdown', version: '1.2' },
  content: [
    { type: 'heading', props: { level: 1 }, content: ['Breathwork Basics'] },
    'Conscious breathing techniques for grounding and clarity…'
  ]
};

/* 4. Utterance Intention: chat message */
export const utterance: Intention = {
  id: '/msg-a12',
  name: 'Morning greeting',
  type: 'utterance',
  createdAt: '2025-07-12T12:04:20Z',
  modifiedAt: '2025-07-12T12:04:20Z',

  owner: '@forest-keeper',
  location: '@two-trees-community',

  state: 'complete',
  metadata: { mentions: ['@two-trees-community'] },
  content: ['Good morning, friends! May your roots run deep today. 🌳']
};

/* 5. Error Intention: workflow failure */
export const errorIntention: Intention = {
  id: '/err-0ff5',
  name: 'Meditation upload failed',
  type: 'error',
  createdAt: '2025-07-12T13:15:42Z',
  modifiedAt: '2025-07-12T13:16:02Z',

  owner: '@healing-bot',
  location: '@two-trees-community',

  state: 'failed',
  metadata: { code: 502, message: 'File processing timeout' },
  content: [
    {
      type: 'code',
      props: { lang: 'bash' },
      content: ['curl -F file=@meditation.mp3 https://api.twotrees/upload']
    },
    'returned 502 Bad Gateway'
  ]
};
```
