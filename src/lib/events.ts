import { EventEmitter } from "events";

// This is a simple singleton pattern for the event emitter.
const globalForEmitter = globalThis as unknown as {
  emitter: EventEmitter | undefined;
};

export const emitter = globalForEmitter.emitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEmitter.emitter = emitter;
}
