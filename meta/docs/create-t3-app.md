Below is a single, merged YAML document that combines the highest-value details from **both** compressions.
It should give a smaller LLM everything it needs—from philosophy to flags, repo anatomy, first-run tips, and deployment—while staying concise and type-safe-focused. ([Create T3 App][1], [GitHub][2], [Create T3 App][3], [Create T3 App][4], [Create T3 App][5])

```yaml
t3_stack_documentation:
  introduction:
    title: "Deep Dive into the T3 Stack & create-t3-app"
    description: "Compressed reference for a smaller LLM: how to scaffold, extend, and operate a T3 Stack project."
    stack_summary: "Modular, typesafe Next.js 15 starter with optional tRPC, Tailwind, Prisma **or** Drizzle, and NextAuth."
    core_principles:
      - "Solve Problems, Not Bloat: ship only what you need (state libraries are BYO)."
      - "Bleed Responsibly: adopt new tech (e.g., tRPC, Drizzle) without abandoning stability (Next.js, Prisma)."
      - "End-to-End Typesafety: strict types from DB ➜ API ➜ UI."

  prerequisites:
    node: "18+ (LTS)"
    package_managers: [npm, pnpm, yarn, bun]

  scaffold:
    commands:
      npm:  "npm create t3-app@latest"
      pnpm: "pnpm create t3-app@latest"
      yarn: "yarn create t3-app"
      bun:  "bun create t3-app@latest"
    interactive_steps:
      - "Name the project"
      - "Pick TypeScript (strongly recommended)"
      - "Select optional packages: tRPC, Tailwind, Prisma or Drizzle, NextAuth"
      - "Init git repo (Y/n)"
      - "Install deps"
    flags:
      general:
        "-y | --default": "Skip prompts, accept defaults"
        "--noGit":        "Skip git init"
        "--noInstall":    "Generate files only"
        "--appRouter":    "Use Next.js App Router (default as of v15)"
        "--CI":           "Non-interactive (chain with other flags)"
      feature_toggles:
        "--trpc":     "Include tRPC"
        "--tailwind": "Include Tailwind"
        "--prisma":   "Include Prisma"
        "--drizzle":  "Include Drizzle ORM"
        "--nextAuth": "Include NextAuth"
      db_provider: "--dbProvider [mysql|postgres|planetscale|sqlite]"
    post_scaffold_scripts:
      dev:   "pnpm dev"
      build: "pnpm build"
      start: "pnpm start"
      lint:  "pnpm lint"

  core_technologies:
    next_js:      "React framework with SSR/SSG, App & Pages routers."
    typescript:   "Static typing for safer refactors."
    trpc:         "End-to-end typesafe RPC (no codegen)."
    tailwind_css: "Utility-first CSS."
    prisma:       "Type-safe ORM, great DX."
    drizzle:      "Lightweight SQL-minded ORM + Drizzle-Kit migrations."
    next_auth:    "Auth for Next.js; default Discord provider in template."

  env_management:
    validator: "@t3-oss/env-nextjs (zod)"
    workflow:
      - "Add KEY=VALUE to .env"
      - "Describe schema in src/env.js (server|client)"
      - "Expose via runtimeEnv mapping"
      - "Mirror non-secret keys in .env.example"

  repository_structure:
    common:
      root_files: [".env", ".env.example", "next.config.mjs", "prisma/schema.prisma", "package.json", "tsconfig.json", ".eslintrc.cjs", "postcss.config.js"]
    pages_router:
      pages: "src/pages/*"
      api:
        nextauth: "src/pages/api/[...nextauth].ts"
        trpc:     "src/pages/api/trpc/[trpc].ts"
      providers: "_app.tsx wraps SessionProvider, Tailwind, etc."
    app_router:
      app: "src/app/(routes)/+layout.tsx & page.tsx"
      api_routes:
        nextauth: "src/app/api/auth/[...nextauth]/route.ts"
        trpc:     "src/app/api/trpc/[trpc]/route.ts"
      providers: "layout.tsx sets up SessionProvider & TRPCProvider"
    server:
      trpc_root:   "src/server/api/root.ts"
      trpc_router: "src/server/api/routers/*"
      trpc_init:   "src/server/api/trpc.ts"
      db_client:   "src/server/db.ts (Prisma) or src/server/db/schema.ts (Drizzle)"
    client_helpers:
      trpc_client_pages: "src/utils/api.ts"
      trpc_client_app:   "src/trpc/index.ts"
      styles: "src/styles/globals.css"

  first_steps_checklist:
    database:
      - "mysql/postgres ➜ ./start-database.sh or external URL"
      - "Prisma ➜ npx prisma db push"
      - "Drizzle ➜ pnpm db:push"
    auth_discord:
      - "Create Discord OAuth app"
      - "Set AUTH_DISCORD_ID & AUTH_DISCORD_SECRET"
      - "Redirect URL: http://localhost:3000/api/auth/callback/discord"
    vscode_extensions: [Prisma, Tailwind CSS IntelliSense, Prettier]

  common_tasks:
    create_trpc_route:
      - "Add model to prisma/schema.prisma or drizzle schema"
      - "Sync DB (prisma db push | drizzle db:push)"
      - "Create router in src/server/api/routers/post.ts"
      - "Use Zod for inputs; export procedures"
      - "Merge into appRouter in root.ts"
      - "Consume via `api.post.getAll.useQuery()`"
    add_state_management (Zustand example):
      - "npm install zustand"
      - "Create src/store/useStore.ts with create()"
      - "Import hook in components"
    add_optional_library_general_process:
      - "npm install <lib>"
      - "If provider needed, wrap in _app.tsx or layout.tsx"
      - "Place config in src/lib or src/store"
    scripts:
      type_check: "pnpm typecheck"
      format:     "pnpm format"

  deployment:
    vercel:
      steps:
        - "Push repo to GitHub"
        - "Import in Vercel, auto-detect Next.js"
        - "Add env vars"
        - "Click Deploy"
    netlify:
      steps:
        - "Import repo, choose Next.js build preset"
        - "Configure env vars"
        - "Deploy"

  optional_libraries:
    state_management:   [zustand, jotai]
    component_ui:       ["@shadcn/ui", radix-ui, headlessui]
    animation:          [framer-motion, auto-animate]
    realtime_infra:     [pusher, soketi, upstash]
    analytics:          [posthog, plausible]

  recommended_add_ons:
    testing:        [jest, vitest, cypress]
    ci_cd:          [GitHub Actions, Turborepo]
    logging:        [pino, sentry]
    hosting_db:     [planetscale, railway, vercel-postgres]

```

[1]: https://create.t3.gg/?utm_source=chatgpt.com "Create T3 App"
[2]: https://github.com/t3-oss/create-t3-app?utm_source=chatgpt.com "t3-oss/create-t3-app: The best way to start a full-stack, typesafe Next ..."
[3]: https://create.t3.gg/en/usage/drizzle?utm_source=chatgpt.com "Drizzle - Create T3 App"
[4]: https://create.t3.gg/en/usage/next-js?utm_source=chatgpt.com "Next.js - Create T3 App"
[5]: https://create.t3.gg/en/faq?utm_source=chatgpt.com "FAQ - Create T3 App"
