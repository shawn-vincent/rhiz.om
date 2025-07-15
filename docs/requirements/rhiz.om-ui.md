# rhiz.om User-Interface Layout — Orin-Style Reference (v 0.1.1)
*Fully elaborated—captures every point verbatim or re-expressed; no new features introduced.*


---

## 1 Space Page: Global Layout Skeleton

### 1.1 Natural Background Layer

1. **Photography as Canvas**

   * A single full-bleed photo of a natural scene, typically *“view downstream along a river in rugged landscape.”*
2. **Transparency Mandate**

   * All UI surfaces (chat bubbles, avatars, navbars, etc.) render with *transparent or semi-transparent fills* so that the background is always perceptible.
3. **Blur Priority Stack**

   * At most three active panels (Chat, VC, Content) are rendered.
   * Only the top (active) panel is *sharp*; all others are blurred proportionally to their depth (exact blur radius unspecified).
   * Blur preserves color and luminance so the photo remains an anchoring substrate.

### 1.2 Persistent Bottom Navbar

| Slot       | Icon(s)                                                      | Function                                                                                         |
| ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Left**   | ① `☰` (menu) ② VC/Chat toggle icon                           | Primary app menu; one-tap switch between Chat and VC when panels are not simultaneously visible. |
| **Center** | **Space name** (text)                                        | Stateless label displaying the current space identity.                                           |
| **Right**  | ① `🎥` (video mute) ② `🎙` (audio mute) ③ `⚙` (space config) | Media muting toggles; entry to space-level settings.                                             |

* Symbols are illustrative; final iconography TBD.
* Navbar height constant across responsive states; remains above photo background.

---

## 2 Chat Panel (Messaging Surface)

### 2.1 Composition & Controls

1. **Input Bubble**

   * Docked at *bottom edge* of Chat panel.
   * Contains:

     * **Open text field** (expands vertically with multiline content).
     * **“+” button** for rich payloads (images, files, etc.).
     * **Send** button (explicit action; no auto-send on Enter by default).

2. **Message Bubbles**

   * Individual, borderless, transparent-background rounded rectangles.
   * **Mini Avatar** at leading edge:

     * If sender has live video **enabled**, a *miniature, real-time* circular video loop appears.
     * If video disabled, static profile image is displayed.
   * Text and embedded rich content overlay directly on background photo; bubble surfaces keep 0-5 % translucency for legibility.

3. **Video Duplication Acknowledged**

   * The same live video stream may appear:

     * (a) full-sized inside VC panel,
     * (b) blurred behind Chat when VC is backgrounded,
     * (c) multiple times as mini avatars next to each authored message.
   * No deduplication logic mandated; designer accepts this multiplicity.

### 2.2 Interaction Model

1. **Reply-to-Message → Forks**

   * Any bubble may be the root of a reply chain.
   * Resulting topology is a *branching tree* (not a flat list).
   * Current visualization of divergent branches is **UNSOLVED**—placeholder nodes OK.

2. **Associative Memory Tokens**

   * Optional floating glyphs near bubbles that expose long-term contextual links to the message.
   * **UNSOLVED VISUAL PROBLEM**: token styling, placement, and hover behaviour remain open.

3. **Focused Entity Transition**

   * Clicking a bubble enters *Focused Entity* mode (see § 5)—the message becomes its own space.

### 2.3 Performance & Persistence

* **Lazy Loading** —messages fetched on scroll demand; viewport retains minimal DOM nodes.
* **Per-Space Storage** —conversation state (history, forks, expanded summaries) is persisted on the space record; entering/exiting the space restores prior scroll and summary collapse state.

### 2.4 Auto-Summarization Stream

| Phase           | Trigger                           | Representation           | Expansion Behaviour                                                           |
| --------------- | --------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| **Recent**      | Always visible                    | Individual messages      | No summarization.                                                             |
| **1 Hour Back** | Scroll past \~60 min mark         | Single AI summary bubble | Click to replace bubble with its constituent messages (or another hierarchy). |
| **1 Day Back**  | Past 24 h                         | Same as above            |                                                                               |
| **1 Week ↘**    | 7 days, 1 month, 1 year, all-time | Progressive AI summaries | Same pattern, exponential falloff.                                            |

*Expanding* one summary auto-**collapses** peer summaries at the same hierarchy depth to keep message count manageable.
\*Visual affordance (e.g., chevron, ripple) still **UNSOLVED**.

---

## 3 Videoconference (VC) Panel

### 3.1 Avatar Tiling Algorithm

1. **Packing Principles**

   * Avatars are perfect circles; collectively fill panel with maximal diameter that avoids overlap.
   * With *N avatars*, diameter scales inversely; algorithm unspecified but must be deterministic.
2. **Adaptive Frame-Rate**

   * Below a size threshold (TBD, e.g., 64 px), each avatar’s video FPS is reduced to conserve bandwidth/CPU; still images allowed at extreme shrink.
3. **Unlimited Participant Count**

   * No upper bound; avatars may shrink to “pixel-size dots” theoretically.

### 3.2 Interaction

* **Focus by Click** —selecting an avatar escalates that being into Focused Entity mode (§ 5).
* **Mute States** —global video/audio mute icons (navbar) override individual streams; avatar indicates mute visually (icon overlay or greyscale).

---

## 4 Responsive Composition Rules

### 4.1 Wide Viewport (Threshold = T\_wide)

```
┌─────────────────────┬─────────────────────┐
│     Chat Panel      │   VC Panel          │
└─────────────────────┴─────────────────────┘
```

* Chat occupies left (or designer-choice primary) column; VC occupies the other.
* Width ratio flexible but both panels fully visible.
* Content panel appears only in Focused Entity context (full overlay).

### 4.2 Narrow Viewport (W < T\_wide)

```
┌─────────────────────┐
│  Top Panel (clear)  │
├─────────────────────┤
│  Back Panel (blur)  │
└─────────────────────┘
```

* Panels stack vertically.
* Exact order: user-selectable via VC/Chat toggle or by focusing.
* The back (lower) panel is blurred heavily to maintain photo exposure yet reduce distraction.

---

## 5 Focused Entity Mode

### 5.1 Trigger Paths

| Entity Type      | Activation                                           |
| ---------------- | ---------------------------------------------------- |
| **Chat Message** | Click bubble.                                        |
| **VC Avatar**    | Click circle.                                        |
| **Intention**    | Click intention representation (not specified here). |

### 5.2 Experience Within Focus

1. **New Space Layer** —Focused Entity becomes a *modal* overlay, occupying entire viewport.
2. **Exit Control** —Prominent **“X”** icon or gesture returns to previous layer.
3. **Recursive Depth** —No system-imposed limit; user can tunnel into Entity→sub-Entity indefinitely.
4. **Panel Priority in Focus**

   * If the focused Being publishes live video → video becomes primary (top) panel inside this layer.
   * If the being is primarily content-bearing (doc, image, etc.) → content panel becomes primary.
   * Remaining two panels (Chat, VC) continue to exist relative to *the focused space’s children* but are backgrounded/blurred.
   * Selection of which of the three surfaces goes top is:

     * Automatic by presence (if only one has content).
     * User-selectable otherwise (tap/swipe).

---

## Site Menu

Logout


## 6 Unresolved / Open Design Tasks

1. **Fork Visualization** – Need UX pattern for exploring message branches without clutter.
2. **Associative Memory Tokens** – Decide iconography, hover details, collision avoidance.
3. **Summary Bubbles** – Determine visual differentiation (size, color, glyph) and transition animation for expand/collapse.
4. **Avatar Packing Algorithm** – Specify exact grid or force-based fit; must support unbounded N.
5. **Performance Budgets** – Define target FPS for mini-video, blur shader cost, lazy-load batch size.
6. **Accessibility Pass** – Ensure transparency & blur still meet contrast guidelines.

---

## 7 Appendix A Element Inventory

| Element        | Properties                         | Dynamic States                          |
| -------------- | ---------------------------------- | --------------------------------------- |
| Navbar Icons   | Size = 24 px; no labels            | Hover tint, active, muted               |
| Chat Bubble    | Corner radius = 16 px; alpha = 0.9 | Normal, reply-target, selected          |
| Mini Avatar    | Diameter = 32–48 px                | Live video, static image, muted overlay |
| VC Avatar      | Diameter = adaptive (≥32 px)       | Speaking glow, muted, focused           |
| Summary Bubble | Distinct border style              | Collapsed, expanded                     |
| Memory Token   | Free-floating glyph                | Linked-on-hover state                   |
| Blur Backdrop  | Gaussian blur                      | Radius levels: 0 / 2 / 4 / 8 px         |

*(Values placeholder unless specified in original notes.)*

---

### 8 Revision History

| Ver   | Date       | Delta                                 |
| ----- | ---------- | ------------------------------------- |
| 0.1   | 2025-07-12 | Initial concise draft (user request). |
| 0.1.1 | 2025-07-12 | Expanded \~5× detail per follow-up.   |

*(End of reference.)*
