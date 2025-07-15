# LLM Prompt

You are an expert full-stack engineer.
Act as a **non-interactive shell & file generator**.

══════════════════════════════════════════════════════════════
Goal
════ • Fresh Next.js 15 TypeScript repo (no Tailwind, no DB).  
════ • Google OAuth via Auth.js (v5 beta, package `next-auth`).  
════ • All steps run unattended on macOS/Linux.  
══════════════════════════════════════════════════════════════

STEP 0 – Clean slate
────────────────────
```bash
rm -rf * .git 2>/dev/null || true
git init -b main
````

STEP 1 – Scaffold project
─────────────────────────

```bash
npx create-next-app@latest . \
  --typescript --eslint --app --import-alias "@/*" \
  --no-tailwind --no-turbopack --no-src-dir
```

STEP 2 – Auth dependency
─────────────────────────

```bash
npm install next-auth@beta
```

STEP 3 – Environment vars
─────────────────────────
Create **.env.local**:

```dotenv
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=$(openssl rand -base64 32)

GOOGLE_ID=__REPLACE_ME__
GOOGLE_SECRET=__REPLACE_ME__
```

STEP 4 – Auth config helper
───────────────────────────
**/auth.ts**

```ts
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const {
  handlers: { GET, POST }, // <-- individual route handlers
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
  ],
})
```

STEP 5 – Auth route
────────────────────
**/app/api/auth/\[...nextauth]/route.ts**

```ts
export { GET, POST } from "@/auth"
```

STEP 6 – Middleware guard
──────────────────────────
**/middleware.ts**

```ts
export { auth as default } from "@/auth"

export const config = {
  matcher: ["/protected/:path*"],
}
```

STEP 7 – Sign-in / Sign-out server actions
───────────────────────────────────────────
**/components/SignIn.tsx**

```tsx
export function SignIn() {
  return (
    <form action={async () => {
      "use server"
      const { signIn } = await import("@/auth")
      await signIn("google", { redirectTo: "/protected" })
    }}>
      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
        Sign in with Google
      </button>
    </form>
  )
}
```

**/components/SignOut.tsx**

```tsx
export function SignOut() {
  return (
    <form action={async () => {
      "use server"
      const { signOut } = await import("@/auth")
      await signOut({ redirectTo: "/" })
    }}>
      <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded">
        Sign out
      </button>
    </form>
  )
}
```

STEP 8 – Pages
──────────────
**/app/page.tsx**

```tsx
import { SignIn } from "@/components/SignIn"

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <SignIn />
    </main>
  )
}
```

**/app/protected/page.tsx**

```tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { SignOut } from "@/components/SignOut"

export default async function Protected() {
  const session = await auth()
  if (!session) redirect("/")

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl">Hello, {session.user?.name ?? "friend"}!</h1>
      <SignOut />
    </main>
  )
}
```

STEP 9 – Run dev server
───────────────────────

```bash
npm run dev
# → open http://localhost:3000
```

🎉 Done – Google sign-in should now complete without the `Function.prototype.apply` crash.

**End of instructions.**

