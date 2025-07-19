// src/lib/logger.client.ts
"use client";

type LogLevel = "info" | "warn" | "error" | "debug";

type LogEntry = {
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
};

let logQueue: LogEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

async function flushLogs() {
  if (logQueue.length === 0) {
    return;
  }

  const logsToSend = [...logQueue];
  logQueue = [];

  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logsToSend), // Send as a single batch
      keepalive: true, // Keep the request alive if the page is unloading
    });
  } catch (error) {
    console.error("Failed to send logs:", error);
  }

  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
}

function enqueueLog(level: LogLevel, msg: string, context: object = {}) {
  // Also log to console in development for immediate feedback
  if (process.env.NODE_ENV === "development") {
    const consoleMethod = level === "error" ? "error" : level === "warn" ? "warn" : "info";
    console[consoleMethod](msg, context);
  }

  logQueue.push({ level, msg, ...context });

  if (!flushTimeout) {
    flushTimeout = setTimeout(flushLogs, 1000); // Batch logs and send every 1 second
  }
}

// Ensure logs are sent before the page unloads
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushLogs);
}

export const log = {
  info: (msg: string, context?: object) => enqueueLog("info", msg, context),
  warn: (msg: string, context?: object) => enqueueLog("warn", msg, context),
  error: (error: Error | string, context?: object) => {
    const msg = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? { stack: error.stack } : {};
    enqueueLog("error", msg, { ...stack, ...context });
  },
  debug: (msg: string, context?: object) => enqueueLog("debug", msg, context),
};
