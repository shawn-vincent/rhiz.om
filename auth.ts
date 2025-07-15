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