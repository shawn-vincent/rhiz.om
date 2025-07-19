# Rhiz.om Architecture — **Popularity-First/LLM-Optimised Replacement**

**Revision 7 · 14 Jul 2025**

> **[supersedes “Rhiz.om Architecture – Old”]{docs/requirements/rhiz.om-architecture-old.md)**
> See heritage/ code for early implementation in old architecture, intended for reference for new architecture.

---

## 0 Rationale & Selection Principles

Rhiz.om now prizes **LLM fluency** above all else: we choose the technology with the **largest public footprint** (GitHub stars, npm installs, Stack Overflow threads).
A larger corpus ⇒ more accurate code-completion, refactors, and error explanations. Performance or novelty matter only when two options are equally popular.

---

## 1 Stack Overview (pinned as of 2025-07-14)

| Layer              | Selection                                   | Version | Release date | npm / source          |
| ------------------ | ------------------------------------------- | ------- | ------------ | --------------------- |
| React framework    | **Next.js**                                 | 15.4.0  | 2025-05-30   | `next@15.4.0`         |
| UI runtime         | **React**                                   | 19.1.0  | 2025-03-28   | `react@19.1.0`        |
| CSS utilities      | **Tailwind CSS**                            | 4.0.0   | 2025-01-22   | `tailwindcss@4.0.0`   |
| Component kit      | **Material UI (MUI)**                       | 7.2.0   | 2025-06-30   | `@mui/material@7.2.0` |
| Auth               | **NextAuth.js**                             | 4.23.1  | 2023-10-18   | `next-auth@4.23.1`    |
| API/server         | **Next.js Route Handlers + Server Actions** | —       | —            | built-in              |
| Real-time (opt-in) | **Socket.IO**                               | 4.8.1   | 2024-10-25   | `socket.io@4.8.1`     |
| ORM                | **Prisma**                                  | 6.11.1  | 2025-07-04   | `prisma@6.11.1`       |
| Database           | **PostgreSQL**                              | 17.3    | 2025-02-13   | server/RDS            |
| Logging            | **pino**                                 | 3.17.0  | 2024-11-10   | `pino@3.17.0`      |
| Unit tests         | **Jest**                                    | 30.0.3  | 2025-06-27   | `jest@30.0.3`         |
| E2E tests          | **Playwright**                              | 1.54.1  | 2025-07-11   | `playwright@1.54.1`   |
| Monorepo tooling   | **npm Workspaces** (Turbo cache optional)   | npm 10+ | —            | node-bundled          |
| Deployment         | **Vercel** (Hobby/free)                     | —       | —            | vercel.com            |

---

## 2 Recommended REST API Scheme

| Rule                                  | Example                            |
| ------------------------------------- | ---------------------------------- |
| Path version prefix                   | `/api/v1/…`                        |
| Plural, kebab-case resources          | `/users`, `/blog-posts`            |
| Hierarchy for ownership               | `/users/{id}/posts/{postId}`       |
| CRUD via HTTP verbs                   | `POST /users`, `PATCH /users/{id}` |
| Filters & pagination via query-string | `/posts?tag=llm&page=2&limit=20`   |
| No trailing slash                     | `/users` not `/users/`             |

This pattern mirrors GitHub, Stripe, Google APIs—giving LLMs maximal prior art.

---

## 3 Detailed Component Notes

| Layer              | Why it wins                                     | Closest rival (pop-gap)                          |
| ------------------ | ----------------------------------------------- | ------------------------------------------------ |
| **Next.js**        | 133 k★, official Vercel templates flood GitHub. | Remix 31 k★ (-76 %).                             |
| **React**          | 237 k★ (largest JS repo).                       | Vue 209 k★ (-12 %).                              |
| **Tailwind**       | ≈20 M downloads/wk vs. Bootstrap 5 M.           | Bootstrap (stars higher, active installs lower). |
| **MUI**            | 96 k★ / 5.6 M downloads/wk.                     | Ant Design 95 k★ / 1.9 M.                        |
| **NextAuth**       | 27 k★ / 1.6 M downloads/wk; Next-native.        | Passport 23 k★.                                  |
| **Route Handlers** | Ship in every Next repo; zero infra.            | Express 67 k★ (needs separate host).             |
| **Socket.IO**      | 62 k★; most WebSocket tutorials.                | Pusher/Ably (closed SDK).                        |
| **Prisma**         | 4 M downloads/wk; TS types.                     | Drizzle 1.4 M.                                   |
| **PostgreSQL**     | #1 DB in SO 2024 (49 %).                        | MySQL 38 %.                                      |
| **pino**        | 15 M downloads/wk, 20 k★.                       | (No direct rival listed)                         |
| **Jest**           | 45 k★; default in older CRA/Next docs.          | Vitest 14 k★.                                    |
| **Playwright**     | 74 k★; surpassed Cypress.                       | Cypress 49 k★.                                   |
| **npm Workspaces** | Ships with Node; 55 % dev share.                | pnpm 32 %.                                       |

---

## 4 Repository Blueprint

```
/rhiz.om
├─ apps/
│  └─ web/               # Next 15 (UI + API)
├─ packages/
│  ├─ ui/                # MUI + Tailwind components
│  ├─ db/                # Prisma schema & migrations
│  └─ shared/            # Zod types, util helpers
├─ turbo.json            # (optional) task cache
├─ package.json          # root + "workspaces"
└─ jest.config.cjs, playwright.config.ts, etc.
```

*Use npm workspaces now; introduce Turborepo caching when CI build times exceed 30 s.*

---

## 5 Operational Conventions

* **API** – Route Handlers + Server Actions only. Add Express + Socket.IO micro-service *if* we need long-lived sockets.
* **Real-time** – Start with SSE; migrate to Socket.IO side-car container if collaboration load grows.
* **Logging** – pino JSON transport to stdout → Vercel Log Drains initially.
* **Testing** – `jest` + `@testing-library/react` (unit) & `playwright test` (E2E).
* **CI** – Turbo (graph cache) + GitHub Actions → Vercel Preview & Production.
* **Vercel Hobby limits** – 100 GB bandwidth / 1 M function invocations per month.


---

## 7 Quality Gates (unchanged)

* Type-check: `tsc -b`, `prisma validate`.
* Lint/format: ESLint, Prettier, Tailwind lint.
* Test coverage ≥ 80 %.
* Playwright smoke must pass in CI on every commit to `main`.

---

*“Harness the hive mind—choose the path most travelled.” — Orin*
