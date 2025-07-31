// instrumentation.ts - Next.js 15 instrumentation hook for console overrides
export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		const { logger } = await import("~/server/lib/logger");
		const nextLogger = logger.child({ name: "Next.js" });

		// Override console methods to route through our logger
		const originalConsole = {
			log: console.log,
			info: console.info,
			warn: console.warn,
			error: console.error,
			debug: console.debug,
		};

		console.log = (...args: unknown[]) => {
			const message = args
				.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
				.join(" ");
			if (
				message.includes("GET ") ||
				message.includes("POST ") ||
				message.includes("PUT ") ||
				message.includes("DELETE ")
			) {
				nextLogger.info(message);
			} else {
				originalConsole.log(...args);
			}
		};

		console.info = (...args: unknown[]) => {
			const message = args
				.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
				.join(" ");
			nextLogger.info(message);
		};

		console.warn = (...args: unknown[]) => {
			const message = args
				.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
				.join(" ");
			nextLogger.warn(message);
		};

		console.error = (...args: unknown[]) => {
			const message = args
				.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
				.join(" ");
			nextLogger.error(message);
		};

		console.debug = (...args: unknown[]) => {
			const message = args
				.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
				.join(" ");
			nextLogger.debug(message);
		};
	}
}
