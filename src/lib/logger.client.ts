import pino from "pino";
import type { ExternalToast } from "sonner";
import { toast } from "./toast";

const DEBUG_LOGGING = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prettyBrowser(log: any) {
	const colour =
		log.level >= 50
			? "color:red"
			: log.level >= 40
				? "color:orange"
				: log.level >= 30
					? "color:cyan"
					: log.level >= 20
						? "color:gray"
						: "color:purple";

	const text =
		{
			10: "TRACE",
			20: "DEBUG",
			30: "INFO",
			40: "WARN",
			50: "ERROR",
			60: "FATAL",
		}[log.level as number] ?? "LVL?";

	return [
		`%c${text.padEnd(5)} %c${log.name ?? ""}%c ${log.msg}`,
		colour,
		"font-weight:bold",
		"color:inherit",
		log, // still clickable → expands full object
	];
}

// helper to post logs; beacon first, fetch fallback
function postLog(payload: string) {
	return (
		navigator.sendBeacon?.("/api/log", payload) ??
		fetch("/api/log", {
			method: "POST",
			body: payload,
			headers: { "Content-Type": "application/json" },
			keepalive: true, // so it still fires during unload
		})
	);
}

// Browser logger configured to debug level and output to the console.
export const logger = pino({
	level: "debug",

	browser: {
		serialize: true, // ⇢ log object is passed to both hooks

		// A) pretty-print in your DevTools
		write(raw) {
			// raw is a POJO when serialize=true
			// (if you prefer serialize:false, JSON.parse(raw) first)
			// eslint-disable-next-line no-console
			console.log(...prettyBrowser(raw));
		},

		// B) forward to the server
		transmit: {
			level: "debug", // send everything you print
			send(level, log) {
				if (level === "error" || level === "fatal") {
					if (log.messages[0] instanceof Error) {
						// If the first message is an Error, use its message
						log.messages[0] = log.messages[0].message;
					}

					toast.error(new String(log.messages), {
						title: level + ": " + new String(log.messages),
						duration: 5000,
						theme: "dark",
					} as ExternalToast);
				}

				const meta = log.bindings.find((b) => "name" in b) ?? {};

				const [first, ...restMsgs] = log.messages; // keep first element as-is

				const rec = {
					level,
					name: meta.name,
					ts: log.ts,
					...meta, // e.g.  { name:'<Guard>' }
					...(typeof first === "object" ? first : {}), // merge extra fields like id
					msg: [
						typeof first === "string" ? first : "", // readable message
						...restMsgs,
					].join(" "),
				};

				if (DEBUG_LOGGING) {
					console.info("Sending to /api/_log", rec);
				}

				postLog(JSON.stringify(rec));
			},
		},
	},
});
