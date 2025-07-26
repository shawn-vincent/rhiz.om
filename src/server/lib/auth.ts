import { eq } from "drizzle-orm";
import { isSuperuser } from "~/lib/permissions";
import { db } from "~/server/db";
import { beings } from "~/server/db/schema";
import { selectBeingSchema } from "~/server/db/types";

export interface AuthContext {
	sessionBeingId: string;
	currentUser: ReturnType<typeof selectBeingSchema.parse> | null;
	isCurrentUserSuperuser: boolean;
}

/**
 * Gets authorization context for a given session being ID
 * Used by both tRPC middleware and REST API routes
 */
export async function getAuthContext(sessionBeingId: string): Promise<AuthContext> {
	// Get current user's being to check superuser status
	const currentUserRaw = await db.query.beings.findFirst({
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