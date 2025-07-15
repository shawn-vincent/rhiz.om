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