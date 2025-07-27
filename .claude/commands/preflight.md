---
description: Preflight chain — Lyra (alignment) → Orin (clean architecture) → Riven (ship gate). Stops on first fail. Optional scope args forwarded to all agents.
argument-hint: [scope or extra instruction]
allowed-tools: Task, Read, Grep, Glob, LS, Bash, Edit, Write, MultiEdit, TodoWrite, WebFetch, WebSearch
---

# Preflight: Lyra → Orin → Riven

**Goal:** Decide if we should ship **now**, and if so, with the smallest true scope.

**Order (stop on first fail)**  
1) **Lyra** — run the alignment/essence review.  
   - Ask: “Use the **lyra** sub agent to assess intention, alignment, karmic shadows, and propose the *minimum ritual to ship now*. Include a 1-sentence Essence.”  
   - If Lyra’s **Alignment verdict** is `MISALIGNED`, **STOP** and print Lyra’s summary + the smallest felt experiment to re-align.

2) **Orin** — if Lyra passes, enforce clean architecture.  
   - Ask: “Use the **orin** sub agent to map layers/flow, list boundary violations, surface-diet cuts, and a 2–4 commit reversible plan. Include tiny safe diffs.”  
   - If Orin’s **Architecture verdict** is not `CLEAN` (`DRIFTING` or `ENTANGLED`), **STOP** and print Orin’s plan and diffs.

3) **Riven** — if Orin passes, run the ship gate.  
   - Ask: “Use the **riven** sub agent to run sanity → typecheck/lint → build → tests → audit → migrations → release. Strip cleverness, propose smallest shippable scope, apply safe fixes.”  
   - If **Gate** is `FAIL`, **STOP** with blocking issues, minimal diffs, and the **shortest path to green** (commands).

**On full pass:**  
- Print a **single, crisp release note** (one paragraph), the **exact commands** to ship, and a **≤15-minute scope** list.  
- Create a TODO list for any non-blocking follow-ups.

**Notes**  
- Forward any extra user text after `/preflight` as the **scope** for all three agents (e.g., “last 20 commits”, “apps/web only”, or “focus on login flow”).  
- Prefer subtraction and smallest diffs throughout.
