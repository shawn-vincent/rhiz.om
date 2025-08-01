import { relations, sql } from "drizzle-orm";
import {
	index,
	jsonb,
	pgTableCreator,
	primaryKey,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";
import { beingId, beingIdNullable, intentionId } from "./custom-columns";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `rhiz_om_${name}`);

// Core "Being" entity table. Represents users, spaces, etc.
export const beings = createTable("beings", {
	id: beingId("id").primaryKey(), // e.g., @shawn-vincent or @some-space
	name: varchar("name", { length: 256 }).notNull(),
	type: varchar("type", { length: 50 }).notNull(), // 'guest', 'being', 'document', etc.
	createdAt: timestamp("createdAt", { withTimezone: true })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	modifiedAt: timestamp("modifiedAt", { withTimezone: true })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	ownerId: beingIdNullable("ownerId").references((): any => beings.id), // Self-referential or to another being
	locationId: beingIdNullable("locationId").references((): any => beings.id),
	extIds: jsonb("extIds"), // { provider: string, id: string }[]
	idHistory: jsonb("idHistory"), // string[]
	metadata: jsonb("metadata"),
	properties: jsonb("properties"),
	content: jsonb("content"),
	// Bot-specific fields
	botModel: varchar("botModel", { length: 255 }), // AI model identifier for bots
	botPrompt: text("botPrompt"), // System prompt for bots (can be very long)
	llmApiKey: text("llmApiKey"), // Per-being API key for LLM services like OpenRouter
});

// "Intention" entity table. Represents actions, like utterances (chat messages).
export const intentions = createTable(
	"intentions",
	{
		id: intentionId("id").primaryKey(), // e.g., /msg-abcde
		name: varchar("name", { length: 256 }).notNull(),
		type: varchar("type", { length: 50 }).notNull(), // 'utterance', 'error'
		createdAt: timestamp("createdAt", { withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		modifiedAt: timestamp("modifiedAt", { withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		ownerId: beingId("ownerId")
			.notNull()
			.references(() => beings.id),
		locationId: beingId("locationId")
			.notNull()
			.references(() => beings.id),
		state: varchar("state", {
			length: 50,
			enum: ["draft", "active", "paused", "complete", "cancelled", "failed"],
		}).notNull(),
		content: jsonb("content").notNull(), // The actual message content
	},
	(t) => ({
		ownerIdx: index("intention_owner_idx").on(t.ownerId),
		locationIdx: index("intention_location_idx").on(t.locationId),
	}),
);

// NextAuth.js User table, now linked to a Being
export const users = createTable("users", (d) => ({
	id: d
		.varchar({ length: 255 })
		.notNull()
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: d.varchar({ length: 255 }),
	email: d.varchar({ length: 255 }).notNull(),
	emailVerified: d
		.timestamp({
			mode: "date",
			withTimezone: true,
		})
		.default(sql`CURRENT_TIMESTAMP`),
	image: d.varchar({ length: 255 }),
	beingId: beingIdNullable("beingId").references(() => beings.id),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
	accounts: many(accounts),
	being: one(beings, {
		fields: [users.beingId],
		references: [beings.id],
	}),
}));

// Standard NextAuth.js tables below
export const accounts = createTable(
	"accounts",
	(d) => ({
		userId: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => users.id),
		type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
		provider: d.varchar({ length: 255 }).notNull(),
		providerAccountId: d.varchar({ length: 255 }).notNull(),
		refresh_token: d.text(),
		access_token: d.text(),
		expires_at: d.integer(),
		token_type: d.varchar({ length: 255 }),
		scope: d.varchar({ length: 255 }),
		id_token: d.text(),
		session_state: d.varchar({ length: 255 }),
	}),
	(t) => [
		primaryKey({ columns: [t.provider, t.providerAccountId] }),
		index("account_user_id_idx").on(t.userId),
	],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
	"sessions",
	(d) => ({
		sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
		userId: d
			.varchar({ length: 255 })
			.notNull()
			.references(() => users.id),
		expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
	}),
	(t) => [index("t_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
	"verification_tokens",
	(d) => ({
		identifier: d.varchar({ length: 255 }).notNull(),
		token: d.varchar({ length: 255 }).notNull(),
		expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
	}),
	(t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
