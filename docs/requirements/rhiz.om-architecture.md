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

| Layer              | Selection                                   | Version    | npm / source                    |
| ------------------ | ------------------------------------------- | ---------- | ------------------------------- |
| React framework    | **Next.js**                                 | 15.2.3     | `next@15.2.3`                   |
| UI runtime         | **React**                                   | 19.0.0     | `react@19.0.0`                  |
| CSS utilities      | **Tailwind CSS**                            | 4.0.15     | `tailwindcss@4.0.15`            |
| Component kit      | **shadcn/ui + Radix UI**                    | latest     | `@radix-ui/*` packages           |
| Auth               | **NextAuth.js**                             | 5.0.0-beta.25 | `next-auth@5.0.0-beta.25`    |
| API/server         | **tRPC + Next.js Route Handlers**           | 11.0.0     | `@trpc/server@11.0.0`           |
| State management   | **TanStack Query**                          | 5.69.0     | `@tanstack/react-query@5.69.0`  |
| ORM                | **Drizzle**                                 | 0.41.0     | `drizzle-orm@0.41.0`             |
| Database           | **PostgreSQL**                              | —          | server                           |
| Validation         | **Zod**                                     | 3.25.76    | `zod@3.25.76`                    |
| Code quality       | **Biome**                                   | 1.9.4      | `@biomejs/biome@1.9.4`           |
| Logging            | **pino**                                    | 9.7.0      | `pino@9.7.0`                     |
| Monorepo tooling   | **npm Workspaces**                          | npm 11+    | node-bundled                     |
| Deployment         | **Vercel**                                  | —          | vercel.com                       |

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

| Layer              | Why chosen                                       | Benefits                                          |
| ------------------ | ----------------------------------------------- | ------------------------------------------------ |
| **Next.js**        | T3 Stack foundation; excellent DX               | App Router, SSR/SSG, API routes, Vercel deploy   |
| **React**          | Industry standard; extensive ecosystem          | Component model, hooks, mature tooling           |
| **Tailwind**       | Utility-first CSS; excellent with Next.js       | Rapid styling, consistent design, small bundle   |
| **shadcn/ui**      | Modern component library; built on Radix        | Accessible, customizable, copy-paste workflow    |
| **NextAuth**       | Next.js native auth; v5 beta for app router     | OAuth providers, session management, security    |
| **tRPC**           | End-to-end type safety; great DX                | No API layer bugs, auto-completion, validation   |
| **TanStack Query** | Best React data fetching; caching               | Background updates, optimistic UI, dev tools     |
| **Drizzle**        | Modern ORM; excellent TypeScript support        | Type-safe SQL, migrations, performance           |
| **PostgreSQL**     | Mature RDBMS; JSON support                      | ACID compliance, extensibility, performance      |
| **Zod**            | Runtime validation; TypeScript integration      | Schema validation, type inference, composability |
| **Biome**          | All-in-one tooling; faster than ESLint          | Linting, formatting, imports - single tool       |
| **pino**           | Fast structured logging; JSON output            | Performance, structured data, ecosystem support  |

---

## 4 Repository Blueprint

```
/rhiz.om
├─ src/
│  ├─ app/               # Next.js App Router (pages & API routes)
│  ├─ components/        # shadcn/ui components + custom
│  ├─ server/            # tRPC routers, auth, database schema
│  ├─ hooks/             # Custom React hooks
│  ├─ lib/               # Utilities, contexts, helpers
│  └─ trpc/              # Client-side tRPC configuration
├─ packages/             # Shared packages (entity-kit, etc.)
├─ docs/                 # Requirements & design documents
├─ drizzle/              # Database migrations
├─ package.json          # npm workspaces configuration
├─ biome.jsonc           # Code quality configuration
└─ drizzle.config.ts, tailwind.config.js, etc.
```

*Current implementation uses npm workspaces for simplicity.*

---

## 5 Operational Conventions

* **API** – tRPC procedures with Next.js Route Handlers. Type-safe end-to-end.
* **Real-time** – Currently polling via TanStack Query; WebSockets planned for future.
* **Logging** – pino structured logging to stdout → Vercel built-in logging.
* **Testing** – Biome for code quality; testing framework TBD.
* **CI** – GitHub Actions with Vercel automatic deployments.
* **Database** – Drizzle migrations; PostgreSQL with JSONB for flexible content.


---

## 7 Quality Gates (unchanged)

* Type-check: `npm run typecheck` (TypeScript compiler).
* Lint/format: `npm run check` (Biome handles linting, formatting, imports).
* Database validation: `drizzle-kit check` for schema consistency.
* Code quality gates enforced before commits to `main`.

---

*“Harness the hive mind—choose the path most travelled.” — Orin*
