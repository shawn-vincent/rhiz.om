// src/app/api/log/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "~/server/lib/logger";

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { level, msg, ...context } = body;

		// Validate log level
		if (!level || typeof logger[level as keyof typeof logger] !== "function") {
			return NextResponse.json(
				{ message: "Invalid log level" },
				{ status: 400 },
			);
		}

		// Create a child logger with browser-specific context
		const browserLogger = logger.child({
			browser: true,
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
