import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  username: text("username").notNull(),
  vellumApiKey: text("vellum_api_key"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: uuid("token").notNull().defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const games = pgTable("games", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  name: text("name").notNull(),
  hostUserId: uuid("host_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("waiting"),
  currentTeam: text("current_team"),
  currentPhase: text("current_phase"),
  winner: text("winner"),
  words: jsonb("words"),
  wordAssignments: jsonb("word_assignments"),
  revealedWords: jsonb("revealed_words").default([]),
  currentClue: text("current_clue"),
  currentClueNumber: integer("current_clue_number"),
  guessesRemaining: integer("guesses_remaining"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gamePlayers = pgTable("game_players", {
  id: uuid("id").notNull().defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  team: text("team").notNull(),
  role: text("role").notNull().default("pending"),
  vellumAgentId: text("vellum_agent_id"),
  agentDisplayName: text("agent_display_name"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  gamePlayers: many(gamePlayers),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  host: one(users, { fields: [games.hostUserId], references: [users.id] }),
  players: many(gamePlayers),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  game: one(games, { fields: [gamePlayers.gameId], references: [games.id] }),
  user: one(users, { fields: [gamePlayers.userId], references: [users.id] }),
}));
