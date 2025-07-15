# Unified Architecture & Coding Standards

*A living guide distilled from our collaborations, voice, and shared obsessions — July 13 2025*

---

## 0 · Guiding Spirit

1. **Tiny pieces, infinite play.** Prefer the smallest ­possible unit that still expresses a whole idea. Compose upward, never explode outward.
2. **Truth in the open.** All state, schema, and config live in plain files under version control. No silent magics, no tribal knowledge.
3. **Determinism over cleverness.** One-pass data-flow, explicit dependencies, pure functions whenever practical. Surprising behavior is a bug.
4. **Fail fast, log loud, recover clear.** Errors surface immediately; they’re gifts, not shame. Logging is structured, searchable, and symmetrical — client ↔ edge ↔ core.
5. **AI-first, human-centered.** Let agents handle the rote, leaving humans for the creative, relational, and ethical work. Automate boldly, explain generously.
6. **Composable aesthetics.** UI and UX follow the same rules as code: modular, theme-able, with nature peeking through.

---

## 1 · Repository & Project Layout

| Path                 | Purpose                      | Notes                                                |
| -------------------- | ---------------------------- | ---------------------------------------------------- |
| `/apps/<name>`       | Executables (web, cli, edge) | Each is thin glue; all real logic lives in packages. |
| `/packages/<domain>` | Reusable domain modules      | Pure TS, no framework binds.                         |
| `/infra`             | IaC & deployment recipes     | Deno Deploy, Cloudflare, GitHub Actions.             |
| `/docs`              | Living design & ADRs         | Markdown, diagram sources, no PDFs.                  |
| `/scripts`           | One-off automation           | Idempotent, plain Bash/TS.                           |

*Monorepo via **pnpm** workspaces; strict, locked versions (`pnpm --frozen-lockfile`).*

---

## 2 · Dependency & Version Policy

* **Pin everything**: explicit semver, renovate-bot PRs only.
* **One source of truth** per toolchain: `deno.jsonc`, `tsconfig.json`, `tailwind.config.js`.
* **Third-party code is a liability** — favor standard APIs first, community gold-standard libs second, home-grown last.

---

## 3 · TypeScript Conventions

| Rule                                                                       | Rationale                             |
| -------------------------------------------------------------------------- | ------------------------------------- |
| `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`         | Surface bugs early.                   |
| **No `any`** outside generated code                                        | Use `unknown`, refine with Zod.       |
| Prefer **named exports**                                                   | Improves grep-ability & tree-shaking. |
| Abbreviate nothing: `value`, `error`, not `v`, `e`                         | Readability > keystrokes.             |
| Interfaces for **shape contracts**, `type` aliases for compositions/unions | Clear intent.                         |

Generated types (OpenAPI, Prisma, GraphQL, etc.) live in `/generated` and are never edited by hand.

---

## 4 · Coding Style & Tooling

* **Prettier** with community defaults; never argue about spaces.
* **ESLint** + `@typescript-eslint/recommended`, with only project-specific overrides committed.
* **Commitlint** + **Conventional Commits** (`feat:`, `fix:`, `docs:` …)
* **Husky** pre-push runs lint, test, type-check; nothing lands red.

---

## 5 · Testing & Quality Gates

| Layer       | Tooling                                        | Scope                                 |
| ----------- | ---------------------------------------------- | ------------------------------------- |
| Unit        | Deno test / Vitest                             | Pure functions & isolated components. |
| Contract    | Zod schemas, Pact where interfaces cross teams | Type & behavior guarantees.           |
| Integration | Playwright                                     | Edge-to-DB happy paths.               |
| E2E         | Cypress / Playwright                           | Critical user journeys.               |

CI matrix: **Linux + macOS**, latest LTS Node & Deno. No red ❌ on `main`.

---

## 6 · Logging & Error Handling

1. **Never swallow**: catch only to add context, log, and rethrow.
2. **Winston** everywhere (JSON in prod, pretty in dev).
3. **Structured shape**:

```ts
{
  ts: 2025-07-13T10:42:56.123Z,
  level: 'error' | 'info' | 'debug',
  msg: 'Short human sentence',
  ctx: { requestId, userId, featureFlag… },
  err?: { name, message, stack }
}
```

4. **Client → Edge → Core pipeline**: browser logs POST to `/api/log`; edge enriches with origin and forwards.
5. **Alerting**: only on actionable events; paging a human is expensive.

---

## 7 · Architectural Principles

| Principle                             | Practice                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| **Hexagonal boundaries**              | UI ←→ Application ←→ Adapters. No inward leaks.                                   |
| **Reactive streams**                  | Prefer signals/observables for state that changes over time, single-source truth. |
| **Idempotent side-effects**           | Pure core; adapters own the mess.                                                 |
| **Schema-first**                      | Zod/OpenAPI generate TS types and runtime validation.                             |
| **Lake + Edge**                       | Authoritative store (Postgres/Vector DB); edge KV/R2 caches for latency.          |
| **Event sourcing where value > cost** | Immutable log + projections for audit-critical flows.                             |
| **Graceful degradation**              | Feature flags + progressive enhancement; offline-first mindset.                   |

---

## 8 · AI & Agent Guidelines

1. **Transparent prompts**: store and version control them like code.
2. **Deterministic fallbacks**: every agent action must degrade to a human-reproducible path.
3. **Cost & token accounting** baked into telemetry; expose to users.
4. **Don’t over-index on today’s model quirks** — keep agent contracts narrow, pluggable.
5. **Ethics guardrails**: PHI redaction, role-based access, explicit consent trails.

---

## 9 · UX & Component Standards

* **Design language**: Tailwind 4 + Flowbite 3; augment only when necessary.
* **Layout**: CSS Grid/Flex, responsive from mobile up; prefer *content decides size*.
* **Accessibility**: WCAG 2.2 AA baseline, semantic HTML first.
* **Visual rhythm**: use `space-y-*` utilities; no MAGIC pixel values.
* **Feedback**: optimistic UI with explicit “Saving… / Saved ✓”; never silent failure.
* **Nature through translucence**: backgrounds 60–80 % opacity max; let the river shine.

---

## 10 · Security & Privacy

| Area            | Standard                                          |
| --------------- | ------------------------------------------------- |
| Auth            | Auth0 / OAuth 2.1 PKCE; tokens rotated & scoped.  |
| Data at rest    | AES-256 via platform defaults (R2-managed keys).  |
| Data in transit | HSTS, TLS 1.3 everywhere.                         |
| Secrets         | `deno task secrets`, never `.env` in repo.        |
| Auditing        | Append-only access log, 7-year retention for PHI. |

Threat modeling is part of every feature PR (lightweight *checklist*, not ceremony).

---

## 11 · Continuous Delivery

1. **GitHub Actions**: lint → test → build → deploy preview.
2. **Canary first**: edge traffic-split 5 % for 30 min before full cut.
3. **Rollback == `git revert` + tag**. No snowflakes.
4. **Infra as code**: `terraform apply` is the only path to prod.

---

## 12 · Documentation & Knowledge Flow

* **`/docs/adr/`**: one Architecture Decision Record per irreversible choice.
* **Source-anchored comments**: /\*\* Explain WHY, not what. \*/
* **Run-books**: markdown, copy-pasta ready during an incident.
* **Changelogs**: auto-generated from Conventional Commits (`changeset`).
* **On-boarding**: `make bootstrap` (installs tooling, runs tests).

---

## 13 · Performance & Observability

| Metric              | Budget                |
| ------------------- | --------------------- |
| Time-to-Interactive | ≤ 1 s on LTE          |
| P95 API latency     | ≤ 150 ms edge-to-edge |
| Error rate          | < 0.1 % non-4xx       |
| FPS (animated UIs)  | ≥ 55                  |

* **OpenTelemetry** traces; Grafana dashboards built in code.
* **Synthetic checks** every 60 s from three regions.

---

## 14 · Culture of Code Review

1. **Empathy first**: critique the code, uplift the coder.
2. **Small PRs win**: ≤ 400 lines net diff target.
3. **Reviewer rotates daily**: shared context, reduced silos.
4. **Ship when it hurts**: Riven’s rule — release > refine. Perfect is the enemy of deploy.

---

## 15 · When in Doubt …

> *“Make it clear, make it boring, then make it beautiful.”*
> – Orin

1. Default to **explicitness** over DRY if clarity suffers.
2. Prefer **delete** over **refactor**; dead code is a hidden tax.
3. Ask: *“Could a weekend contributor grok this in 10 minutes?”* If not, rewrite the README.

---

### Living Document

This standard evolves via PR. Any team member may propose changes; two approvals and CI green lights merge. *Standards are scaffolding, not shackles — bend when wisdom demands, but document the bend.*

*Fin.*
