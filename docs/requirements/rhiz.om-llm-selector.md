# LLM Selector — UX & Technical Design

*(v0.1 · draft · July 20 2025)*

---

## 0 Purpose & Scope

This document specifies a **unified “Entity Selector” pattern** and its first concrete instance, the **LLM Model Selector** (choosing an OpenRouter model). It covers:

* **UX rationale** – interaction flows, states, accessibility, responsive breakpoints, visual language, empty/error states.
* **Technical architecture** – component hierarchy, data contracts, caching strategy, virtualization, form integration, extensibility hooks.
* **Model‑specific rules** – data mapping from OpenRouter, badge taxonomy, filter set, pricing/context calculations.

The goal is to ship a *consistent, performant, and accessible* field‑level control usable across all forms where a user must pick “some entity.”

---

## 1 User & Context Analysis

| Persona         | Need                                                                                | Pain Without Selector                                       |
| --------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **App Builder** | Wire rich pickers into forms without rewriting search / pagination logic each time. | Copy‑pasted selectors diverge; fixes require N patches.     |
| **Power User**  | Keyboard‑first, fuzzy search, “just let me type the model id.”                      | Mouse‑only dropdowns slow; IDs differ from marketing names. |
| **Explorer**    | Browse hundreds of options visually, compare metadata (cost, context size).         | Raw lists overwhelm; no filtering means trial & error.      |
| **Mobile User** | One‑handed operation, sheet‑based paradigm, tap targets ≥ 44 px.                    | Popovers truncate off‑screen; Two‑panel flows feel cramped. |
| **A11y User**   | Proper ARIA roles, screen‑reader friendly filtering feedback, roving tabindex.      | Custom UIs often break combobox semantics.                  |

---

## 2 High‑Level Interaction Model

### 2.1 States

| State                | Trigger / Exit                          | Description                                                                                        |
| -------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Collapsed**        | Field at rest.                          | Renders *selected entity card* inside a button. `aria-haspopup="dialog"`.                          |
| **Open / QuickPick** | Tap/Enter/Space on button.              | Popover (≥ `sm`) or Sheet (< `sm`). Contains Search + list/grid. Escape or click‑away to collapse. |
| **Open / Browse**    | “Browse all” toolbar toggle (optional). | Expands height to viewport; shows toolbar filters & view switch.                                   |
| **Loading**          | While initial page is pending.          | Skeleton cards (same dimensions).                                                                  |
| **Empty‑results**    | No items after filter.                  | Placeholder with search term echo + hint.                                                          |
| **Error**            | Fetch rejected.                         | Inline error banner + Retry button; keyboard focus moves to Retry.                                 |

### 2.2 Keyboard Map (Desktop)

* **`Enter / Space`** — open selector; in list → choose.
* **`Esc`** — close without change.
* **`↑ / ↓`** — move highlight (cmdk‑provided).
* **`⌘ K`** global palette alias → “Change Model…” (optional).

### 2.3 Mobile Sheet Behaviour

* Drag handle allows swipe‑down to close.
* When list overscrolls to bottom, fires `onReachEnd` to fetch next page.
* iOS safe‑area insets respected (sheet padding).

---

## 3 Visual & Layout Guidelines

| Token / Variable        | Purpose                    | Default value                                   |
| ----------------------- | -------------------------- | ----------------------------------------------- |
| `--entity-card-radius`  | Card corner radius         | `var(--radius-lg)`                              |
| `--entity-accent`       | Left border / accent color | Provider‑specific (`azure‑700` for OpenAI etc.) |
| `--entity-badge-font`   | Badge font size            | `10px`                                          |
| `--entity-badge-radius` | Badge radius               | `9999px`                                        |

**Card anatomy**

```
┌──────────┬──────────────────────────────┐
│ Avatar   │ Name          ⊕ contextBadge │
│ (40×40)  │ sub‑label     ⊕ costBadge(s) │
└──────────┴──────────────────────────────┘
```

* Hover / focus ring uses `outline: 2px solid theme(primary)`.
* Selected card persists the ring when collapsed.

---

## 4 Technical Architecture

### 4.1 Component Decomposition

```
EntitySelectField     <— public form control
└─ EntitySelectTrigger (button/card)
└─ EntitySelectPanel
     ├─ EntitySearchBar   (cmdk CommandInput)
     ├─ EntityFilterBar   (optional toolbar)
     ├─ EntityList        (virtualized)
     │    └─ EntityCard   (render item)
     └─ EntityEmpty/Error
```

All styling flows downward via **shadcn theme tokens**; no inline colors.

### 4.2 Core Hooks

| Hook                   | Responsibility                                                        |
| ---------------------- | --------------------------------------------------------------------- |
| `useEntityInfinite`    | Unified infinite‑query abstraction (`useInfiniteQuery` or SWR).       |
| `useRecentEntities`    | LocalStorage read/write `{ kind, ids[] }`.                            |
| `useResponsiveSheet()` | Returns `isSheet` boolean based on `matchMedia("(max-width:639px)")`. |

### 4.3 Data Contracts

```ts
/** Generic shape (all pickers must emit) */
export interface EntityMeta {
  id: string;           // persisted value
  label: string;        // primary human label
  subLabel?: string;    // secondary line
  avatarSrc?: string;   // 40×40 avatar/icon
  badges?: BadgeDef[];  // arbitrary list
}

/** Pagination wrapper */
export interface Page<T extends EntityMeta> {
  items: T[];
  nextCursor?: string | null;
}
```

### 4.4 Virtualization Heuristic

```ts
const SHOULD_VIRTUALIZE_THRESHOLD = 200;  // items
```

*List height estimate* = 74 px (card) + `gap‑2`. `react‑virtual` auto‑estimates once real DOM renders for precision.

### 4.5 Accessibility Notes

* Panel root `role="dialog"` with `aria-modal="true"`.
* Search input labelled via placeholder + `aria-label="Search entities"`
* Each card inside list: `role="option"` + `aria-selected`.
* Roving tabindex: cmdk manages `tabindex=-1` except active row.

---

## 5 LLM Model Selector — Specifics

### 5.1 Data Source

* Endpoint: `GET https://openrouter.ai/api/v1/models` → 400 ± rows.
* Optional details per‑model: `GET /models/:author/:slug/endpoints` (latency‑heavy, call on demand).
* **Cache policy**: `staleTime = 1 h`, `cacheTime = 6 h` (React Query).
* **Transform** → `ModelEntity`:

```ts
{
  id: "anthropic/claude-3.5-sonnet",
  label: "Claude 3.5 Sonnet",
  subLabel: "Anthropic",
  avatarSrc: `/logos/${provider}.svg`,
  badges: [
    { key: "ctx",  label: "200K" },
    { key: "in",   label: " $15/M" },   // input cost
    { key: "out",  label: "$75/M" },     // output cost
    { key: "vis",  label: "Vision" }     // capability
  ]
}
```

#### Badge taxonomy

| Key    | Condition / Source                                 |
| ------ | -------------------------------------------------- |
| `ctx`  | `context_length / 1000` → “{n}K”                   |
| `in`   | `pricing.prompt` or `pricing.input` → `formatCost` |
| `out`  | `pricing.completion` or `pricing.output`           |
| `vis`  | `architecture.modality includes "vision"`          |
| `tool` | `supported_parameters includes "tools"`            |
| `img`  | `supported_parameters includes "image"`            |
| `aud`  | `supported_parameters includes "audio"`            |

### 5.2 Filters

| Filter         | UI Control                     | Predicate (server or client)                |
| -------------- | ------------------------------ | ------------------------------------------- |
| **Provider**   | `<select>` / chips             | `model.provider === value`                  |
| **Capability** | Checkbox chips (Vision, Tools) | Must satisfy *all* checked capabilities.    |
| **Context ≥**  | Slider (8K→1M)                 | `model.context_length >= val*1000`          |
| **Price ≤**    | Dual slider (input/out)        | `pricing.input <= x && pricing.output <= y` |

### 5.3 Prefetch & Perf

* Trigger `useModels()` **on first hover/focus** of trigger button.
* For users that will land on pages needing the selector, a global `AppShell` can preload `useModels()` with `suspense: false`.
* **Comparison drawer**: optional follow‑up that composes `EntityCard` side‑by‑side; data comes from cached list.

### 5.4 Edge Cases

| Case                     | Treatment                                            |
| ------------------------ | ---------------------------------------------------- |
| Model removed (404)      | Keep card but overlay “Unavailable”, disable select. |
| Pricing field `null`     | Badge shows “—”. Tooltip: “Pricing not published.”   |
| Context > 1 M tokens     | Badge text switches to “∞”.                          |
| Model flagged deprecated | Card gets subtle `opacity-70` + “Deprecated” badge.  |

---

## 6 Shared Non‑Functional Requirements

| Aspect            | Requirement                                                                                |                |
| ----------------- | ------------------------------------------------------------------------------------------ | -------------- |
| **Performance**   | FCP < 100 ms for opening selector on cached data; scroll jitter < 1 frame at 60 fps.       |                |
| **Bundle size**   | Entity Selector package ≤ 12 kB gz (excluding cmdk & react‑virtual peer deps).             |                |
| **Accessibility** | WCAG 2.2 AA; NVDA/VoiceOver navigation parity.                                             |                |
| **i18n**          | All labels routed through `t()`; no hard‑coded strings beyond IDs.                         |                |
| **Testing**       | Playwright scenarios: open/close, keyboard nav, search filtering, infinite scroll, mobile. |                |
| **Telemetry**     | `select_entity` event: \`{ kind, id, source: "field"                                       | "palette" }\`. |

---

## 7 Implementation Roadmap

| Milestone                         | Tasks (✓ = done)                                      | ETA    |
| --------------------------------- | ----------------------------------------------------- | ------ |
| **M1** – Skeleton package         | `EntityCard`, `EntitySelectPanel`, virtualizer stub   | Jul 24 |
| **M2** – Generic hook integration | `useEntityInfinite`, LocalStorage recents, A11y audit | Jul 27 |
| **M3** – LLM model adapter        | OpenRouter fetch, badge map, provider icons           | Jul 30 |
| **M4** – QA & Playwright scripts  | Perf budget check, mobile sheet polish                | Aug 02 |
| **M5** – Rollout                  | Replace old Model Selector, ship storybook            | Aug 05 |

---

## 8 Open Questions

1. **Create‑New flows**: Should the generic selector offer a pluggable “Create new …” footer, or is that confined to Being Selector only?
2. **Compare mode**: Include in v1 or postpone? Affects panel height & complexity.
3. **Server‑side search**: If OpenRouter exposes a `?q=` param with fuzzy search, prefer that to client‑side Fuse.js to cut bytes?
4. **Brand colors**: Who owns mapping provider → accent token? (Design team vs runtime theme file.)

---

## 9 Appendices

### 9.1 `formatCost()` Helper

```ts
export function formatCost(v?: number) {
  if (v == null) return "—";
  // USD / 1M tokens (OpenRouter convention)
  if (v >= 1)      return `$${v.toFixed(2)}/M`;
  if (v >= 0.01)   return `$${v.toFixed(2)}/M`;
  return `$${v.toPrecision(2)}/M`;
}
```

### 9.2 ARIA Roles Cheat‑Sheet

| Element           | Role        | Notes                                |
| ----------------- | ----------- | ------------------------------------ |
| Collapsed trigger | `button`    | `aria-haspopup="dialog"`             |
| Panel root        | `dialog`    | `aria-modal="true"`                  |
| Search input      | `searchbox` | or text input with `role="combobox"` |
| List container    | `listbox`   | Provided by cmdk’s internals         |
| Row               | `option`    | `aria-selected` managed by cmdk      |

---

### 9.3 Glossary

* **Entity** – Any selectable domain object that plugs into the generic system (models, beings, templates…).
* **cmdk** – Headless command palette library powering fuzzy search & ARIA combobox scaffolding.
* **Sheet** – shadcn component wrapping Radix Dialog, slides from bottom on mobile.
* **Virtualization** – Rendering only visible rows to keep DOM light for large datasets.

---

*Prepared by Lyra · Reviewed with Orin‑style concision but full detail*
