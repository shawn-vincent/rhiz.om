import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm"; // Import eq for queries
import type { DefaultSession, NextAuthConfig, Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { type BeingId, generateBeingId } from "~/lib/types";
import { db } from "~/server/db";
import {
	accounts,
	beings, // Import beings table
	sessions,
	users,
	verificationTokens,
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
			beingId?: BeingId; // Add beingId to session user
			// ...other properties
			// role: UserRole;
		} & DefaultSession["user"];
	}

	interface User {
		beingId?: BeingId; // Add beingId to User type
	}
}

declare module "@auth/core/jwt" {
	interface JWT {
		beingId?: BeingId; // Add beingId to JWT token
	}
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
	pages: {
		signIn: "/auth/signin",
	},
	useSecureCookies: process.env.NODE_ENV === "production",
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
		async redirect({ url, baseUrl }) {
			// Allows relative callback URLs
			if (url.startsWith("/")) return `${baseUrl}${url}`;
			// Allows callback URLs on the same origin
			if (new URL(url).origin === baseUrl) return url;
			return baseUrl;
		},
		async jwt({ token, user, account, profile }) {
			// Handle dev mode authentication
			if (process.env.NODE_ENV === "development") {
				// Check if this is a dev mode session by looking at the token
				if (token.devMode) {
					return token;
				}
			}

			if (user) {
				token.beingId = user.beingId;
			}
			return token;
		},
		async session({ session, token, user }): Promise<Session> {
			// Handle dev mode sessions
			if (process.env.NODE_ENV === "development" && token?.devMode) {
				return {
					...session,
					user: {
						...session.user,
						id: token.sub as string,
						beingId: token.beingId,
					},
				} as Session;
			}

			return {
				...session,
				user: {
					...session.user,
					id: user?.id ?? (token?.sub as string),
					beingId: (user?.beingId as BeingId) ?? token?.beingId,
				},
			} as Session;
		},
		async signIn({ user, account, profile }) {
			if (!user.id) {
				return false; // User ID is required
			}

			// Check if the user already has a being
			const existingUser = await db.query.users.findFirst({
				where: eq(users.id, user.id),
			});

			let userBeingId = existingUser?.beingId;

			if (!userBeingId) {
				// If user doesn't have a beingId, create a new Being
				const newBeingId = generateBeingId();
				const extIds = account
					? [{ provider: account.provider, id: account.providerAccountId }]
					: [];

				const { createBeing } = await import("~/lib/being-operations");

				await createBeing(
					db,
					{
						id: newBeingId,
						name: user.name || "Unnamed Being",
						type: "guest", // Default type for user-associated beings
						extIds: extIds,
						ownerId: newBeingId, // Self-owned
					},
					{
						sessionBeingId: newBeingId,
						currentUser: null,
						isCurrentUserSuperuser: true, // System operation
					},
				);

				// Update the user with the new beingId
				await db
					.update(users)
					.set({ beingId: newBeingId })
					.where(eq(users.id, user.id));

				userBeingId = newBeingId;
			} else {
				// If user already has a beingId, ensure extId is present
				const currentBeing = await db.query.beings.findFirst({
					where: eq(beings.id, userBeingId),
				});

				if (currentBeing && account) {
					const currentExtId = {
						provider: account.provider,
						id: account.providerAccountId,
					};
					const existingExtIds = (currentBeing.extIds || []) as {
						provider: string;
						id: string;
					}[];

					const extIdExists = existingExtIds.some(
						(ext) =>
							ext.provider === currentExtId.provider &&
							ext.id === currentExtId.id,
					);

					if (!extIdExists) {
						// Add the new extId to the existing Being's extIds
						const updatedExtIds = [...existingExtIds, currentExtId];
						const { updateBeing } = await import("~/lib/being-operations");

						await updateBeing(
							db,
							{
								id: userBeingId,
								extIds: updatedExtIds,
								ownerId: userBeingId, // Required field
							},
							{
								sessionBeingId: userBeingId,
								currentUser: null,
								isCurrentUserSuperuser: true, // System operation
							},
						);
					}
				}
			}
			return true; // Allow sign in
		},
	},
} satisfies NextAuthConfig;
