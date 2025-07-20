# Being Selector · Comprehensive UX + Technical Design
*(Version 1.6 – Jul 20 2025 · supersedes v1.2)*

---

## 0 Context

* **Target stack:** Next 14 (app‑router), React 18, TypeScript 5.4, shadcn/ui 0.9+, Tailwind 4, TanStack Query 5 & Virtual 4, tRPC, Zod, Drizzle (PostgreSQL).
* **Entity universe:** 4 Being kinds – `space | guest | bot | document`. Hard upper bound in 2025 road‑map: **≤ 100 000 rows**.
* The selector must also serve as the pattern for future entity pickers (e.g. Model, Intent Template).

---

## 1 Shared “Entity Kit” (foundation for ALL selectors)

| Artifact                     | Responsibility                                                                                | API (public surface only)                                                                   | Key implementation notes                                                                                              |                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **1. `EntityCard`**          | Render any entity tile (avatar, label, badges).                                               | `tsx <EntityCard entity=… variant?:'compact' accent? onClick?>`                             | *48 × 48* avatar; two text lines; left accent bar `accent=true`; `variant='compact'` truncates to single line + icon. |                                                                                  |
| **2. `EntitySkeleton`**      | Placeholder row identical height to card.                                                     | \`lines?:1                                                                                  | 2\`                                                                                                                   | Uses Tailwind `animate-pulse`; fallback to gray block if prefers‑reduced‑motion. |
| **3. `VirtualList`**         | Headless wrapper for TanStack Virtual.                                                        | `tsx <VirtualList items rowHeight overscan renderRow onEndReach/>`                          | Absolute‑position items; default `rowHeight=48`; emits `onEndReach()` when 90 % scrolled.                             |                                                                                  |
| **4. `ResponsiveShell`**     | Popover (≥ sm) ↔ Drawer (< sm) switch.                                                        | `open · onOpenChange · trigger · panel`                                                     | Popover width 420 px; Drawer full‑height with built‑in `Sheet` backdrop.                                              |                                                                                  |
| **5. `EntitySelectPanel`**   | Universal picker UI (search, list, filters, empty/error).                                     | `tsx <EntitySelectPanel value? onSelect fetchPage filtersNode?>`                            | Internally: CommandInput (debounced 200 ms) → VirtualList → Skeleton/Empty/Error states.                              |                                                                                  |
| **6. `createSelectField()`** | Factory that wraps a *useXXX()* hook + card renderer into RHF/HouseForm ready selector.       | `ts createSelectField(useHook, renderCard) → { Select, SelectField }`                       | Delivers **uncontrolled** (`value·onChange`) **and** **controlled** (`ControllerProps`) flavours.                     |                                                                                  |
| **7. Utility hooks**         | `useDeferredSearch(query, delay)` – typed debounce; `useRecents(key,max)` – localStorage LRU. | -                                                                                           | Recents persisted under `rhizom.recents.<entity>`.                                                                    |                                                                                  |
| **8. Design tokens**         | `--entity-card-radius`(6 px) & four accent vars (`--entity-accent-bot` …).                    | -                                                                                           | Defined in `tailwind.config.js` – see §6.                                                                             |                                                                                  |
| **9. Storybook stories**     | Visual spec & regression targets.                                                             | `EntityCard`, `EntitySelectPanel` (mock data size knob), `ResponsiveShell` (viewport knob). | Use *Chromatic* for CI snapshots.                                                                                     |                                                                                  |

> **Deliverables:** `/packages/entity-kit/*` with exhaustive unit tests (Vitest) + docs MDX.

---

## 2 Being‑specific layer

### 2.1 tRPC endpoint

`trpc.being.search`

```ts
input = z.object({
  q:        z.string().max(120).default(''),
  kind:     z.enum(['space','guest','bot','document']).optional(),
  sort:     z.enum(['name','createdAt']).default('name'),
  limit:    z.number().int().min(1).max(100).default(50),
  cursor:   z.string().uuid().nullish(),
});
output = { items: BeingSummary[]; nextCursor: string|null }
```

* **Fuzzy search:** `ILIKE '%' || plainto_tsquery(q) || '%'` with pg\_trgm index.
* **Ordering:** secondary `ORDER BY created_at DESC` when `sort='createdAt'`.
* **Perf target:** ≤ 40 ms P95 on 100 k table (index‑only plan).
* **Cache header:** `s-maxage=30, stale-while-revalidate=60` (edge functions).

### 2.2 Hook `useBeings()`

```ts
export function useBeings(initialKind?: BeingKind) {
  // local state
  const [query, setQuery]   = useState('');
  const [kind,  setKind]    = useState<BeingKind|undefined>(initialKind);
  const [sort,  setSort]    = useState<'name'|'createdAt'>('name');

  const qDeferred = useDeferredValue(query);          // avoids instant refetch
  const queryKey  = ['beings', qDeferred, kind, sort];

  const rq = api.being.search.useInfiniteQuery(
    { q: qDeferred, kind, sort, limit: 50 },
    { getNextPageParam: (last) => last.nextCursor, staleTime: 5*60_000 }
  );

  // flatten pages for VirtualList
  const items = useMemo(() => rq.data?.pages.flatMap(p => p.items) ?? [], [rq.data]);

  const recents = useRecents('beings', 20);

  return { query, setQuery, kind, setKind, sort, setSort, ...rq, items, recents };
}
```

### 2.3 Filters toolbar (Drawer only)

```
┌─────Type─────┐ ┌────Sort────┐
│ All ▾        │ │ Name A‑Z ▾ │
└──────────────┘ └────────────┘
```

* **Type Select** – shadcn `Select`; values `All | Spaces | Guests | Bots | Docs`.
* **Sort Menu**  – shadcn `Select`; `Name A‑Z | Name Z‑A | Newest | Oldest`.

Toolbar passed into `EntitySelectPanel` via `filtersNode`.

### 2.4 Create‑new flow

* Appears when result list empty **and** current user has `canCreateBeings`.
* Renders as `CommandItem` with `Plus` icon → navigates to `/beings/new?q=<query>` (drawer on mobile).
* After create completes, new id auto‑selected and panel closes (listen to router event).

### 2.5 Recents feature

* On every successful `onSelect(id)` call, push id → LRU set (localStorage).
* When panel opens, inject **CommandGroup “Recent”** (max 5) before main list.
* Recent items resolved from `TanStack Query` cache if present; else background‑fetch individually.

### 2.6 Analytics instrumentation

```ts
track('select_being', {
  id, kind, location: props.analyticsOrigin /* e.g. 'form.owner' */,
});
```

Batch events with `flushInterval=10 s` to reduce network chatter.

---

## 3 UI states & micro‑interactions

| State                    | Visual spec                                                         | Notes                                           |
| ------------------------ | ------------------------------------------------------------------- | ----------------------------------------------- |
| **Loading (first page)** | 3 × `EntitySkeleton`, opacity 50 % background.                      | Popover width stays fixed to avoid reflow.      |
| **Loading more**         | `Spinner` row pinned bottom right of list.                          | Spinner hidden when `isFetchingNextPage=false`. |
| **Error (initial)**      | `AlertDestructive` full‑width inside panel; Retry button → refetch. |                                                 |
| **Error (pagination)**   | Toast “Couldn’t load more results” + sticky Retry footer.           |                                                 |
| **Empty (query)**        | `CommandEmpty` → icon + “No beings found”.                          | Provide `Create new` CTA if allowed.            |
| **Disabled field**       | Trigger button gets `opacity‑50 pointer‑events‑none`.               | For read‑only forms.                            |

**Motion:**

* Popover – fade+scale `95 % → 100 %` 150 ms ease‑out.
* Drawer – slide‑up `translateY(100 %) → 0` 200 ms; overshoot `‑4 px` spring.
* Virtual rows – no motion to keep perf.

---

## 4 Accessibility walkthrough (desktop)

1. **Tab** → trigger button (`role=combobox`, `aria-expanded=false`).
2. **Enter / Space** opens popover (`aria-expanded=true`, focus moves to search).
3. Search field labelled “Search beings”.
4. Up/Down arrow traverses rows (`aria-activedescendant` managed by Command).
5. **Enter** selects & closes; focus returns to trigger.
6. **Esc** closes without selection.
7. Screen reader reads: “@acme‑space, space, option 3 of 10”.

Drawer path mirrors but focus trap inside `Sheet`.

---

## 5 Styling spec

```css
/* accent bar */
.entity-accent::before{
  content:''; width:3px; height:100%; inset-inline-start:0; position:absolute;
  border-radius:9999px;
}

[data-kind="space"]   .entity-accent::before{ background-color:var(--entity-accent-space);}
[data-kind="guest"]   .entity-accent::before{ background-color:var(--entity-accent-guest);}
[data-kind="bot"]     .entity-accent::before{ background-color:var(--entity-accent-bot);}
[data-kind="document"].entity-accent::before{ background-color:var(--entity-accent-doc);}
```

Card text styles adopt shadcn `text-foreground` + `text-muted-foreground`.

Dark mode supported automatically via CSS variables.

---

## 6 Performance & memory targets

| Metric (desktop)                   | Budget                           | Test               |
| ---------------------------------- | -------------------------------- | ------------------ |
| Popover first meaningful paint     | ≤ 120 ms (90th)                  | Lighthouse CI      |
| Scroll CPU time                    | < 4 ms/frame on 2017 MacBook Pro | React Profiler     |
| Memory after 100 open/close cycles | ≤ 1.5 × baseline                 | Leak‑Hunter script |

VirtualList ensures DOM nodes ≤ (visible rows + overscan) ≈ 20.

---

## 7 Testing plan (expanded)

| Layer                 | Tool                                    | Coverage                                                     |
| --------------------- | --------------------------------------- | ------------------------------------------------------------ |
| **Unit**              | Vitest                                  | Debounce util; useRecents logic; VirtualList overscan maths. |
| **Component**         | Jest + RTL                              | EntitySelectPanel renders skeleton → items → select event.   |
| **Visual regression** | Chromatic                               | EntityCard (4 kinds, light/dark), popover open/closed.       |
| **Integration**       | Cypress CT                              | HouseForm with BeingSelectField passes Zod schema on submit. |
| **E2E**               | Playwright                              | Desktop vs iPhone 14 viewport; network = “Slow 3G” path.     |
| **Accessibility**     | Axe‑core + cypress‑axe                  | No violations in open panel.                                 |
| **Perf regression**   | Lighthouse CI + custom scroll benchmark | Fail build if FMP > 200 ms or scroll script > 6 ms.          |

---

## 8 Implementation timeline (6 effective dev days)

| Day                | Work‑items                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **0 (pre‑sprint)** | Review spec; resolve open questions (avatars, perms).                                        |
| **1**              | Build EntityCard, Skeleton, tokens; Storybook 🎨                                             |
| **2**              | VirtualList util + ResponsiveShell.                                                          |
| **3**              | EntitySelectPanel (desktop path) with mock hook.                                             |
| **4**              | Hook `useBeings()` + tRPC endpoint (mock DB) → plug in; Drawer/mobile path; Filters toolbar. |
| **5**              | createSelectField → BeingSelect/BeingSelectField; form demo; Recents cache; analytics hooks. |
| **6**              | Error/empty states, test suite, a11y pass, Lighthouse budget; documentation.                 |

---

## 9 Hand‑off deliverables

1. **Code PR** to `feature/being-selector`.
2. **Storybook** deployed (Chromatic) with controls for dataset size, theme, viewport.
3. **DOCS:** `/docs/being-selector.md` – 600 words usage, props table, embedding guide.
4. **QA report** – Playwright + Axe run logs, Lighthouse JSON.
5. **Perf script** – `scripts/bench-scroll.ts` for CI.

“Definition of Done” = all deliverables merged, tests green, Storybook & CI links posted in release notes.

---

### Appendix A — Open questions (must resolve pre‑impl)

| # | Topic                                          | Decision needed by            |
| - | ---------------------------------------------- | ----------------------------- |
| 1 | Avatar fallback style (initials vs identicon)  | design sync Day 0             |
| 2 | Permission matrix for **Create‑new Being** CTA | product owner Day 0           |
| 3 | Future i18n (LTR vs RTL accents)               | not blocker; track in backlog |

---

This spec now enumerates every shared component, all Being‑specific logic, full props/events, styling tokens, performance budgets, and test plan. It is ready for direct implementation by the dev team.
