// src/app/api/log/route.ts
import { type NextRequest, NextResponse } from "next/server";
import superjson from "superjson";
import { auth } from "~/server/auth";
import { getAuthContext } from "~/server/lib/auth";
import { logger } from "~/server/lib/logger";

export async function POST(req: NextRequest) {
	try {
		const rawBody = await req.text();
		const body = superjson.parse(rawBody) as any;
		const { level, msg, ...context } = body;

		// Validate log level
		if (!level || typeof logger[level as keyof typeof logger] !== "function") {
			return NextResponse.json(
				{ message: "Invalid log level" },
				{ status: 400 },
			);
		}

		// Get auth context to add being information
		let authInfo = {};
		try {
			const session = await auth();
			if (session?.user?.beingId) {
				const authContext = await getAuthContext(session.user.beingId);
				authInfo = {
					beingId: session.user.beingId,
					beingName: authContext.currentUser?.name || session.user.name,
				};
			}
		} catch (error) {
			// Don't fail logging if auth fails, just log without auth context
			console.warn("Failed to get auth context for logging:", error);
		}

		// Prepend 💻 emoji to component name for client logs
		if (context.name) {
			context.name = `💻 ${context.name}`;
		}

		// Create a child logger with browser-specific context
		const browserLogger = logger.child({
			browser: true,
			...authInfo,
			// You can add more context from the request here, e.g., IP address
			// ip: req.ip,
		});

		// Log the message from the client
		(
			browserLogger[level as "info" | "warn" | "error" | "debug"] as (
				obj: object,
				msg?: string,
			) => void
		)(context, msg);

		return NextResponse.json({ message: "Log received" }, { status: 200 });
	} catch (error) {
		// Use the main logger to log errors in the logger itself
		logger.error(error, "Failed to process client log");
		return NextResponse.json(
			{ message: "Error processing log" },
			{ status: 500 },
		);
	}
}
