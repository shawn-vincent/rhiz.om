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