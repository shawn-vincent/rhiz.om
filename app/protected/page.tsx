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