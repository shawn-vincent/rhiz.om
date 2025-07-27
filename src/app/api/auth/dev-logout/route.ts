import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { sessions } from "~/server/db/schema";

export async function POST(request: Request) {
	// Only allow in development mode
	if (process.env.NODE_ENV !== "development") {
		return NextResponse.json(
			{ error: "Dev logout only available in development" },
			{ status: 403 },
		);
	}

	try {
		const cookieStore = await cookies();
		const sessionToken = cookieStore.get("authjs.session-token")?.value;

		if (sessionToken) {
			// Remove session from database
			await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));

			// Clear the session cookie
			cookieStore.delete("authjs.session-token");
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Dev logout error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
