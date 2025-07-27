import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { beings, sessions, users } from "~/server/db/schema";

export async function GET(request: Request) {
	// Only allow in development mode
	if (process.env.NODE_ENV !== "development") {
		return NextResponse.json(
			{ error: "Dev login only available in development" },
			{ status: 403 },
		);
	}

	try {
		const url = new URL(request.url);
		const callbackUrl = url.searchParams.get("callbackUrl") || "/";
		const beingId = "@test-user-being"; // Fixed dev user

		// Check if being exists, if not create it
		let being = await db.query.beings.findFirst({
			where: eq(beings.id, beingId),
		});

		if (!being) {
			// Create the being
			await db.insert(beings).values({
				id: beingId,
				name: `Test User (${beingId})`,
				type: "guest",
				extIds: [],
			});

			being = await db.query.beings.findFirst({
				where: eq(beings.id, beingId),
			});
		}

		// Check if user exists, if not create it
		const testUserId = "test-user-id";
		const user = await db.query.users.findFirst({
			where: eq(users.id, testUserId),
		});

		if (!user) {
			await db.insert(users).values({
				id: testUserId,
				name: `Test User (${beingId})`,
				email: "test@example.com",
				beingId: beingId,
			});
		} else if (user.beingId !== beingId) {
			// Update user's beingId if different
			await db
				.update(users)
				.set({ beingId: beingId })
				.where(eq(users.id, testUserId));
		}

		// Create a proper NextAuth session in the database
		const sessionToken = `dev-session-${Date.now()}-${Math.random()}`;
		const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

		// Create session in database
		await db.insert(sessions).values({
			sessionToken: sessionToken,
			userId: testUserId,
			expires: sessionExpires,
		});

		const cookieStore = await cookies();

		// Set the session cookie to match NextAuth.js format
		cookieStore.set("authjs.session-token", sessionToken, {
			httpOnly: true,
			secure: false, // Allow non-HTTPS in dev
			sameSite: "lax",
			path: "/",
			expires: sessionExpires,
		});

		// Redirect to callback URL
		return NextResponse.redirect(new URL(callbackUrl, request.url));
	} catch (error) {
		console.error("Dev login error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
