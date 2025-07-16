import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { v4 as uuidv4 } from 'uuid'; // Import uuid for generating IDs
import { eq } from 'drizzle-orm'; // Import eq for queries

import { db } from "~/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
  beings, // Import beings table
} from "~/server/db/schema";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      beingId?: string; // Add beingId to session user
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    beingId?: string; // Add beingId to User type
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    GoogleProvider,
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.id) {
        return false; // User ID is required
      }

      let userBeingId = user.beingId;

      if (!userBeingId) {
        // If user doesn't have a beingId, create a new Being
        const newBeingId = uuidv4();
        const extIds = account ? [{ provider: account.provider, id: account.providerAccountId }] : [];

        await db.insert(beings).values({
          id: newBeingId,
          name: user.name || 'Unnamed Being',
          type: 'user', // Default type for user-associated beings
          extIds: extIds,
        });

        // Update the user with the new beingId
        await db.update(users)
          .set({ beingId: newBeingId })
          .where(eq(users.id, user.id));

        userBeingId = newBeingId;
      } else {
        // If user already has a beingId, ensure extId is present
        const existingBeing = await db.query.beings.findFirst({
          where: eq(beings.id, userBeingId),
        });

        if (existingBeing && account) {
          const currentExtId = { provider: account.provider, id: account.providerAccountId };
          const existingExtIds = (existingBeing.extIds || []) as { provider: string, id: string }[];

          const extIdExists = existingExtIds.some(
            (ext) => ext.provider === currentExtId.provider && ext.id === currentExtId.id
          );

          if (!extIdExists) {
            // Add the new extId to the existing Being's extIds
            const updatedExtIds = [...existingExtIds, currentExtId];
            await db.update(beings)
              .set({ extIds: updatedExtIds })
              .where(eq(beings.id, userBeingId));
          }
        }
      }
      return true; // Allow sign in
    },
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        beingId: user.beingId, // Ensure beingId is in the session
      },
    }),
  },
} satisfies NextAuthConfig;
