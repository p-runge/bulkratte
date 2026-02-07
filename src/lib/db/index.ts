import { env } from "@/env";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { conditionEnum, languageEnum, rarityEnum, variantEnum } from "./enums";

export const db = drizzle(env.DATABASE_URL);

/**
 * --------------------------------
 * Core data fetched from external APIs
 * -------------------------------
 */

// Set table
export const setsTable = pgTable("sets", {
  id: varchar("id", { length: 16 }).primaryKey(),
  created_at: timestamp("created_at", { mode: "string" })
    .notNull()
    .defaultNow(),
  updated_at: timestamp("updated_at", { mode: "string" })
    .notNull()
    .defaultNow(),
  name: varchar("name", { length: 128 }).notNull(),
  logo: text("logo"),
  abbreviation: varchar("abbreviation", { length: 5 }),
  symbol: varchar("symbol", { length: 128 }),
  releaseDate: date("release_date").notNull(),
  total: integer("total").notNull(),
  totalWithSecretRares: integer("total_with_secret_rares").notNull(),
  series: varchar("series", { length: 128 }).notNull(),
});
export type Set = typeof setsTable.$inferSelect;

// Card table
export const cardsTable = pgTable("cards", {
  id: varchar("id", { length: 16 }).primaryKey(),
  created_at: timestamp("created_at", { mode: "string" })
    .notNull()
    .defaultNow(),
  updated_at: timestamp("updated_at", { mode: "string" })
    .notNull()
    .defaultNow(),
  name: varchar("name", { length: 128 }).notNull(),
  number: varchar("number", { length: 32 }).notNull(),
  rarity: rarityEnum(),
  imageSmall: text("image_small").notNull(),
  imageLarge: text("image_large").notNull(),
  setId: varchar("set_id", { length: 16 })
    .notNull()
    .references(() => setsTable.id),
});
export type Card = typeof cardsTable.$inferSelect;

// Card Price table
export const cardPricesTable = pgTable("card_prices", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  created_at: timestamp("created_at", { mode: "string" })
    .notNull()
    .defaultNow(),
  updated_at: timestamp("updated_at", { mode: "string" })
    .notNull()
    .defaultNow(),
  card_id: text("card_id").notNull().unique(),
  price: integer().notNull(),
});

/**
 * --------------------------------
 * Localization
 * -------------------------------
 */

// Localizations table for translating core data
export const localizationsTable = pgTable(
  "localizations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    table_name: varchar("table_name", { length: 64 }).notNull(),
    column_name: varchar("column_name", { length: 64 }).notNull(),
    record_id: varchar("record_id", { length: 16 }).notNull(),
    language: languageEnum().notNull(),
    value: text("value").notNull(),
    created_at: timestamp("created_at", { mode: "string" })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Unique constraint: one translation per table+column+record+language
    uniqueTranslationIdx: index("unique_translation_idx").on(
      table.table_name,
      table.column_name,
      table.record_id,
      table.language,
    ),
    // Index for faster lookups by record
    recordLookupIdx: index("record_lookup_idx").on(
      table.table_name,
      table.record_id,
    ),
  }),
);

/**
 * --------------------------------
 * Auth data
 * -------------------------------
 */

// ...existing code...

// Users table
export const usersTable = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("email_verified"),
  image: varchar("image", { length: 255 }),
});

// Accounts table
export const accountsTable = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (table) => ({
    primaryKey: [table.provider, table.providerAccountId],
    userIdIndex: index("account_user_id_idx").on(table.userId),
  }),
);

// Sessions table
export const sessionsTable = pgTable(
  "sessions",
  {
    sessionToken: varchar("session_token", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    expires: timestamp("expires").notNull(),
  },
  (table) => ({
    userIdIndex: index("session_user_id_idx").on(table.userId),
  }),
);

// Verification Tokens table
export const verificationTokensTable = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires").notNull(),
  },
  (table) => ({
    primaryKey: [table.identifier, table.token],
  }),
);

// ...existing code...

/**
 * --------------------------------
 * User data
 * -------------------------------
 */

// export const usersTable = pgTable("users", {
//   id: uuid("id")
//     .primaryKey()
//     .default(sql`gen_random_uuid()`),
//   discord_id: varchar("discord_id", { length: 32 }).notNull(),
//   username: varchar("username", { length: 64 }).notNull(),
//   avatar_url: text("avatar_url"),
//   favorite_language: languageEnum(),
//   created_at: timestamp("created_at", { mode: "string" })
//     .notNull()
//     .defaultNow(),
// });

export const userCardsTable = pgTable("user_cards", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").notNull(),
  card_id: text("card_id").notNull(),
  language: languageEnum(),
  variant: variantEnum(),
  condition: conditionEnum(),
  notes: text("notes"),
  created_at: timestamp("created_at", { mode: "string" })
    .notNull()
    .defaultNow(),
  updated_at: timestamp("updated_at", { mode: "string" })
    .notNull()
    .defaultNow(),
});

export const userSetsTable = pgTable("user_sets", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  created_at: timestamp("created_at", { mode: "string" })
    .notNull()
    .defaultNow(),
  updated_at: timestamp("updated_at", { mode: "string" })
    .notNull()
    .defaultNow(),
  name: varchar("name", { length: 128 }).notNull(),
  image: text("image"),
  user_id: uuid("user_id")
    .notNull()
    .references(() => usersTable.id),
  preferred_language: languageEnum(),
  preferred_variant: variantEnum(),
  preferred_condition: conditionEnum(),
});

export const userSetCardsTable = pgTable(
  "user_set_cards",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    created_at: timestamp("created_at", { mode: "string" })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { mode: "string" })
      .notNull()
      .defaultNow(),
    user_set_id: uuid("user_set_id")
      .notNull()
      .references(() => userSetsTable.id),
    card_id: varchar("card_id", { length: 16 })
      .notNull()
      .references(() => cardsTable.id),
    user_card_id: uuid("user_card_id")
      .references(() => userCardsTable.id)
      .unique(),
    order: integer("order").notNull(),
  },
  (table) => ({
    uniqueUserSetOrderIdx: uniqueIndex("unique_user_set_order_idx").on(
      table.user_set_id,
      table.order,
    ),
  }),
);
