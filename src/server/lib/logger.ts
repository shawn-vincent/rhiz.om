// src/server/lib/logger.ts
import pino from "pino";
import pretty from "pino-pretty";

// Base options for all environments
const pinoOptions: pino.LoggerOptions = {
	level: process.env.NODE_ENV === "development" ? "debug" : "info",
};

// In development, create a synchronous pretty-printing stream.
// In production, this will be undefined, and pino will log JSON to stdout.
const prettyStream =
	process.env.NODE_ENV === "development"
		? pretty({
				colorize: true,
				levelFirst: true,
				translateTime: "SYS:h:MM:ss.l TT",
				ignore: "pid,hostname", // Remove process ID and hostname from logs
			})
		: undefined;

// If a prettyStream exists (in dev), pass it as the second argument.
// Otherwise (in prod), the second argument is undefined, and pino logs JSON.
export const logger = pino(pinoOptions, prettyStream);
