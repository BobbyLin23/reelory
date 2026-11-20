import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const MEDIA_TYPES = ["movie", "tv"] as const;

export const LIBRARY_STATUSES = ["want", "watching", "watched"] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

// One row per title a user has saved. Title metadata is snapshotted at save
// time (D7) so the library, lists, and stats render without calling TMDB.
export const libraryEntries = sqliteTable(
  "library_entries",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    genres: text("genres", { mode: "json" }).$type<string[]>().notNull().default([]),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mediaType: text("media_type", { enum: MEDIA_TYPES }).notNull(),
    posterPath: text("poster_path"),
    status: text("status", { enum: LIBRARY_STATUSES }).notNull(),
    title: text("title").notNull(),
    tmdbId: integer("tmdb_id").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    userId: text("user_id").notNull(),
    year: integer("year"),
  },
  (table) => [
    uniqueIndex("library_entries_user_title_unique").on(
      table.userId,
      table.tmdbId,
      table.mediaType,
    ),
    index("library_entries_user_status_idx").on(table.userId, table.status),
    check("library_entries_media_type_check", sql`${table.mediaType} in ('movie', 'tv')`),
    check("library_entries_status_check", sql`${table.status} in ('want', 'watching', 'watched')`),
  ],
);

// One row per watch, so a second row is a rewatch (no rewatch flag) and each
// episode of a series carries its own date. `watched_on` is a calendar date
// (YYYY-MM-DD) so stats group by day, and optional so old watches can be
// logged without inventing one. `rating` is 1-10, rendered as half stars.
export const watchEntries = sqliteTable(
  "watch_entries",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    episode: integer("episode"),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    mediaType: text("media_type", { enum: MEDIA_TYPES }).notNull(),
    rating: integer("rating"),
    review: text("review"),
    season: integer("season"),
    tmdbId: integer("tmdb_id").notNull(),
    userId: text("user_id").notNull(),
    watchedOn: text("watched_on"),
  },
  (table) => [
    index("watch_entries_user_watched_on_idx").on(table.userId, table.watchedOn),
    check("watch_entries_media_type_check", sql`${table.mediaType} in ('movie', 'tv')`),
    check("watch_entries_rating_check", sql`${table.rating} between 1 and 10`),
  ],
);

// One row per user for metadata language and watch region (D6). Both are
// request parameters for TMDB, never columns on a library entry, because they
// only choose which metadata is fetched. A null column means the user has not
// saved that preference and the request locale applies.
export const userPreferences = sqliteTable("user_preferences", {
  language: text("language"),
  region: text("region"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  userId: text("user_id").primaryKey(),
});

export const lists = sqliteTable(
  "lists",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    description: text("description"),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => [index("lists_user_id_idx").on(table.userId)],
);

export const listItems = sqliteTable(
  "list_items",
  {
    addedAt: integer("added_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    listId: text("list_id")
      .notNull()
      .references(() => lists.id, { onDelete: "cascade" }),
    mediaType: text("media_type", { enum: MEDIA_TYPES }).notNull(),
    position: integer("position").notNull(),
    tmdbId: integer("tmdb_id").notNull(),
  },
  (table) => [
    uniqueIndex("list_items_list_title_unique").on(table.listId, table.tmdbId, table.mediaType),
    index("list_items_list_position_idx").on(table.listId, table.position),
    check("list_items_media_type_check", sql`${table.mediaType} in ('movie', 'tv')`),
  ],
);

export type LibraryEntry = typeof libraryEntries.$inferSelect;
export type WatchEntry = typeof watchEntries.$inferSelect;
export type List = typeof lists.$inferSelect;
export type ListItem = typeof listItems.$inferSelect;
