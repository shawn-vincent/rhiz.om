// Custom Drizzle column types for BeingId and IntentionId
import { varchar } from "drizzle-orm/pg-core";
import type { BeingId, IntentionId } from "~/lib/types";

// Create branded varchar columns that return the correct types
export const beingId = (name: string) =>
	varchar(name, { length: 255 }).$type<BeingId>();

export const beingIdNullable = (name: string) =>
	varchar(name, { length: 255 }).$type<BeingId | null>();

export const intentionId = (name: string) =>
	varchar(name, { length: 255 }).$type<IntentionId>();
