// src/server/db/types.ts
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import * as schema from "./schema";

// --- Component Schemas for JSONB columns ---

// Schema for a single external ID
export const extIdSchema = z.object({
	provider: z.string(),
	id: z.string(),
});

// Recursive schemas for nested ContentNode structure
// We must explicitly type the base interfaces for z.lazy() to work correctly.
interface ContentDataIsland {
	type: string;
	props?: Record<string, unknown>;
	content?: ContentNode[];
}
type ContentNode = string | ContentDataIsland;

const contentDataIslandSchema: z.ZodType<ContentDataIsland> = z.object({
	type: z.string(),
	props: z.record(z.string(), z.unknown()).optional(),
	content: z.lazy(() => z.array(contentNodeSchema)).optional(),
});

const contentNodeSchema = z.union([z.string(), contentDataIslandSchema]);

// --- Main Table Schemas ---

// Create base schemas and extend them with proper JSONB column types
const baseSelectBeingSchema = createSelectSchema(schema.beings);
const baseInsertBeingSchema = createInsertSchema(schema.beings);
const baseSelectIntentionSchema = createSelectSchema(schema.intentions);
const baseInsertIntentionSchema = createInsertSchema(schema.intentions);

// Beings - extend base schemas with proper JSONB column types
export const selectBeingSchema = baseSelectBeingSchema.extend({
	extIds: z.array(extIdSchema).nullable(),
	idHistory: z.array(z.string()).nullable(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
	properties: z.record(z.string(), z.unknown()).nullable(),
	content: z.array(contentNodeSchema).nullable(),
	botModel: z.string().nullable(),
	botPrompt: z.string().nullable(),
	llmApiKey: z.string().nullable(),
});

export const insertBeingSchema = baseInsertBeingSchema.extend({
	extIds: z.array(extIdSchema).optional(),
	idHistory: z.array(z.string()).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	properties: z.record(z.string(), z.unknown()).optional(),
	content: z.array(contentNodeSchema).optional(),
	botModel: z.string().optional(),
	botPrompt: z.string().optional(),
	llmApiKey: z.string().optional(),
});

// Intentions - extend base schemas with proper JSONB column types
export const selectIntentionSchema = baseSelectIntentionSchema.extend({
	content: z.array(contentNodeSchema), // This field is non-nullable
});

export const insertIntentionSchema = baseInsertIntentionSchema.extend({
	content: z.array(contentNodeSchema),
});

// Users (no jsonb columns, so no custom schema needed)
export const selectUserSchema = createSelectSchema(schema.users);
export const insertUserSchema = createInsertSchema(schema.users);

// --- ID Types (from data model spec) ---

/** A Being's canonical identifier */
export type BeingId = `@${string}` | `/${string}`;

/** An Intention's identifier – **always** begins with `/` */
export type IntentionId = `/${string}`;

// --- Inferred TypeScript Types ---

// Select Types (for reading from the DB)
export type Being = z.infer<typeof selectBeingSchema>;
export type Intention = z.infer<typeof selectIntentionSchema>;
export type SelectUser = z.infer<typeof selectUserSchema>;

// Insert Types (for writing to the DB)
export type InsertBeing = z.infer<typeof insertBeingSchema>;
export type InsertIntention = z.infer<typeof insertIntentionSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
