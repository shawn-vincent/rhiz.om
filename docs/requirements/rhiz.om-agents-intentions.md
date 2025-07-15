### Rootwork Agent / LLM — **Spec v6**

*(Orin-cut: same atom-level rigor, calendrical lenses.)*

---

## 1 · Canon of Entities (unchanged)

Beings, Agents, llmConfig, Intention, Space, SummaryChunk, ID helpers, dual Zod + TS types — **all exactly as in v5**.

Only delta: **`SummaryChunk.resolution` is now a *calendar band***
`'lastHour' | 'lastDay' | 'lastWeek' | 'lastMonth' | 'lastYear' | 'allTime'`.

---

## 2 · StateStore API (added calendar hint)

```ts
interface StateStore {
  /* unchanged Being + Intention ops */

  /** Summaries at or finer than the requested band. 
   *  e.g. ask 'lastWeek' → returns chunks for
   *  lastHour, lastDay, lastWeek. */
  getSummaryChunks(
    spaceId: string,
    maxBand: CalendarBand      // <- new enum
  ): Promise<SummaryChunk[]>;
}
type CalendarBand =
  | 'lastHour'
  | 'lastDay'
  | 'lastWeek'
  | 'lastMonth'
  | 'lastYear'
  | 'allTime';
```

---

## 3 · Summary Engine – Calendrical Edition

| Phase             | Action                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trigger**       | Every `upsertIntention()` → micro-task for that Space.                                                                                                                                                                                                                                                                                      |
| **Partition**     | Split Intentions into **time buckets**:<br>① `now – 1 hour`, ② `1 hour–24 h`, ③ `24 h–7 days`, ④ `7 d–30 d`, ⑤ `30 d–365 d`, ⑥ `> 365 d`.                                                                                                                                                                                                   |
| **Windowing**     | *Within each bucket*, group sequential Intentions into fixed-size windows:<br>• `lastHour`: 1-message windows (verbatim or skip if branch collapsed).<br>• `lastDay`: 4-message windows.<br>• `lastWeek`: 8-message windows.<br>• `lastMonth`: 16-message windows.<br>• `lastYear`: 32-message windows.<br>• `allTime`: 64-message windows. |
| **Delta detect**  | Hash each window’s `content + toolResult`; update only changed hashes.                                                                                                                                                                                                                                                                      |
| **LLM summarise** | For updated windows call streaming model: *“Summarise the following N messages in ≤K tokens.”* (`K` shrinks with older buckets).                                                                                                                                                                                                            |
| **Persist**       | UPSERT `SummaryChunk{ range, resolution = band, text, tokenCount, createdAt }`.                                                                                                                                                                                                                                                             |
| **Serve**         | `getSummaryChunks(spaceId, 'lastWeek')` returns chunks for `lastHour`, `lastDay`, and `lastWeek` **already ordered**.                                                                                                                                                                                                                       |

Rationale

* **Temporal relevance** beats geometric spacing.
* Window sizes increase with age → graceful detail falloff.
* “All time” bucket is finite because windows widen until a single chunk spans everything older than a year.

Performance unchanged: hash gate keeps LLM calls rare; six bucket scans max.

---

## 4 · LLM Context Compiler (band-aware)

Step 6 (“Visible Intentions + Summaries”) now:

```
For each open branch:
  • fetch direct Intentions verbatim via StateStore
For collapsed zones:
  • choose 'maxBand' so total prompt ≤ target tokens
  • call getSummaryChunks(spaceId, maxBand)
```

Default UI token budget picks bands progressively (`lastHour` ⇒ `allTime`) until cap reached — always calendar-aligned.

---

## 5 · Runtime Modules (logic same, bands injected)

* **SpaceServer** still merges raw Intentions + banded summaries to form “timeline” feed for UI or AgentRuntime.
* **AgentRuntime**, **ToolRegistry**, **LLM Service** unchanged; they consume compiled prompt without band awareness.

---

## 6 · Event Flows & Observability

Flows identical to v5; metrics unchanged. New log: `summary_band_refresh {band}`.

---

## 7 · File Skeleton (unchanged)

```
common/ids.ts
common/schemas.ts       // CalendarBand enum + updated SummaryChunk schema
state/store.ts          // SummaryEngine with calendar logic
server/space-server.ts
server/agent-runtime.ts
tools/index.ts
```

---

**Changes vs v5:** archiver still absent; summary resolution now strictly *calendrical bands*—`lastHour` → `allTime`—with widening windows per bucket and API/engine updated accordingly. No other alterations.
