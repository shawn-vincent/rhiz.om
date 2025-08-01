import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { isSuperuser } from "~/lib/permissions";
import type { BeingId } from "~/lib/types";
import type { DrizzleDB } from "~/server/db";
import { beings } from "~/server/db/schema";
import { selectBeingSchema } from "~/server/db/types";
import type { Being } from "~/server/db/types";

export interface AuthContext {
	sessionBeingId: BeingId;
	currentUser: Being | null;
	isCurrentUserSuperuser: boolean;
}

export class AuthService {
	constructor(private db: DrizzleDB) {}

	/**
	 * Validates session and returns auth context
	 * Throws UNAUTHORIZED if session is invalid
	 */
	async validateSession(session: Session | null): Promise<AuthContext> {
		if (!session) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "No session found - please log in",
			});
		}

		if (!session.user) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "Invalid session - no user data",
			});
		}

		if (!session.user.beingId) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: `Authentication incomplete - user ${session.user.id || "unknown"} missing beingId. Please sign out and sign in again.`,
			});
		}

		return this.getAuthContext(session.user.beingId);
	}

	/**
	 * Gets authorization context for a given session being ID
	 * Used by both tRPC middleware and REST API routes
	 */
	async getAuthContext(sessionBeingId: BeingId): Promise<AuthContext> {
		// Get current user's being to check superuser status
		const currentUserRaw = await this.db.query.beings.findFirst({
			where: eq(beings.id, sessionBeingId),
		});

		const currentUser = currentUserRaw
			? selectBeingSchema.parse(currentUserRaw)
			: null;
		const isCurrentUserSuperuser = isSuperuser(currentUser);

		return {
			sessionBeingId,
			currentUser,
			isCurrentUserSuperuser,
		};
	}

	/**
	 * Validates session with minimal auth info (just ensuring user exists)
	 */
	validateBasicSession(session: Session | null): Session {
		if (!session?.user) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "Authentication required",
			});
		}
		return session;
	}
}
