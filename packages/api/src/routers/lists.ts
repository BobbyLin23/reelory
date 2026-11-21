import { ORPCError } from "@orpc/server";
import { listItems, lists } from "@reelory/db/schema";
import type { MediaType } from "@reelory/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../context";
import { protectedProcedure } from "../index";
import { titleKey } from "./title-key";

/** Poster collages show the first few titles, so the Lists tab never reads a whole list. */
const PREVIEW_SIZE = 4;

export interface ListSummary {
  id: string;
  itemCount: number;
  name: string;
  preview: { mediaType: MediaType; tmdbId: number }[];
}

const listId = z.uuid();

const listName = z
  .string()
  .trim()
  .min(1, { message: "Give the list a name." })
  .max(100, { message: "Keep the name under 100 characters." });

const ownedList = (userId: string, id: string) => and(eq(lists.id, id), eq(lists.userId, userId));

const requireOwnedList = async (db: Context["db"], userId: string, id: string) => {
  const list = await db.select().from(lists).where(ownedList(userId, id)).get();
  if (!list) {
    throw new ORPCError("NOT_FOUND");
  }
  return list;
};

const afterLastPosition = async (db: Context["db"], listIdValue: string) => {
  const last = await db
    .select({ position: sql<number | null>`max(${listItems.position})` })
    .from(listItems)
    .where(eq(listItems.listId, listIdValue))
    .get();
  return (last?.position ?? -1) + 1;
};

export const listsRouter = {
  addItem: protectedProcedure
    .input(titleKey.extend({ listId }))
    .handler(async ({ context, input }) => {
      const list = await requireOwnedList(context.db, context.auth.userId, input.listId);
      const existing = await context.db
        .select({ id: listItems.id })
        .from(listItems)
        .where(
          and(
            eq(listItems.listId, list.id),
            eq(listItems.tmdbId, input.tmdbId),
            eq(listItems.mediaType, input.mediaType),
          ),
        )
        .get();
      if (existing) {
        return { added: false };
      }

      const inserted = await context.db
        .insert(listItems)
        .values({
          listId: list.id,
          mediaType: input.mediaType,
          position: await afterLastPosition(context.db, list.id),
          tmdbId: input.tmdbId,
        })
        .onConflictDoNothing({
          target: [listItems.listId, listItems.tmdbId, listItems.mediaType],
        })
        .returning({ id: listItems.id });

      return { added: inserted.length > 0 };
    }),

  create: protectedProcedure
    .input(z.object({ name: listName }))
    .handler(({ context, input }) =>
      context.db
        .insert(lists)
        .values({ name: input.name, userId: context.auth.userId })
        .returning()
        .get(),
    ),

  // Items cascade from the list; library entries and watch records are unrelated rows.
  delete: protectedProcedure.input(z.object({ id: listId })).handler(async ({ context, input }) => {
    const deleted = await context.db
      .delete(lists)
      .where(ownedList(context.auth.userId, input.id))
      .returning({ id: lists.id })
      .get();
    if (!deleted) {
      throw new ORPCError("NOT_FOUND");
    }
    return deleted;
  }),

  // The title page needs to know which of the user's lists already hold this title.
  forTitle: protectedProcedure.input(titleKey).handler(async ({ context, input }) => {
    const rows = await context.db
      .select({ id: lists.id, itemId: listItems.id, name: lists.name })
      .from(lists)
      .leftJoin(
        listItems,
        and(
          eq(listItems.listId, lists.id),
          eq(listItems.tmdbId, input.tmdbId),
          eq(listItems.mediaType, input.mediaType),
        ),
      )
      .where(eq(lists.userId, context.auth.userId))
      .orderBy(desc(lists.createdAt), desc(lists.id));

    return rows.map((row) => ({
      hasTitle: row.itemId !== null,
      id: row.id,
      name: row.name,
    }));
  }),

  get: protectedProcedure.input(z.object({ id: listId })).handler(async ({ context, input }) => {
    const list = await requireOwnedList(context.db, context.auth.userId, input.id);
    const items = await context.db
      .select({
        id: listItems.id,
        mediaType: listItems.mediaType,
        tmdbId: listItems.tmdbId,
      })
      .from(listItems)
      .where(eq(listItems.listId, list.id))
      .orderBy(asc(listItems.position), asc(listItems.addedAt), asc(listItems.id));

    return { id: list.id, items, name: list.name };
  }),

  // Every list belongs to one user. Titles stay in the order they were added, and
  // the preview repeats that order so a collage shows the first four additions.
  overview: protectedProcedure.handler(async ({ context }) => {
    const rows = await context.db
      .select({
        itemId: listItems.id,
        listId: lists.id,
        mediaType: listItems.mediaType,
        name: lists.name,
        tmdbId: listItems.tmdbId,
      })
      .from(lists)
      .leftJoin(listItems, eq(listItems.listId, lists.id))
      .where(eq(lists.userId, context.auth.userId))
      .orderBy(
        desc(lists.createdAt),
        desc(lists.id),
        asc(listItems.position),
        asc(listItems.addedAt),
        asc(listItems.id),
      );

    const summaries = new Map<string, ListSummary>();
    for (const row of rows) {
      const summary: ListSummary = summaries.get(row.listId) ?? {
        id: row.listId,
        itemCount: 0,
        name: row.name,
        preview: [],
      };
      if (row.itemId !== null && row.mediaType !== null && row.tmdbId !== null) {
        summary.itemCount += 1;
        if (summary.preview.length < PREVIEW_SIZE) {
          summary.preview.push({ mediaType: row.mediaType, tmdbId: row.tmdbId });
        }
      }
      summaries.set(row.listId, summary);
    }

    return [...summaries.values()];
  }),

  removeItem: protectedProcedure
    .input(titleKey.extend({ listId }))
    .handler(async ({ context, input }) => {
      const list = await requireOwnedList(context.db, context.auth.userId, input.listId);
      const removed = await context.db
        .delete(listItems)
        .where(
          and(
            eq(listItems.listId, list.id),
            eq(listItems.tmdbId, input.tmdbId),
            eq(listItems.mediaType, input.mediaType),
          ),
        )
        .returning({ id: listItems.id })
        .get();
      return { removed: removed !== undefined };
    }),

  rename: protectedProcedure
    .input(z.object({ id: listId, name: listName }))
    .handler(async ({ context, input }) => {
      const updated = await context.db
        .update(lists)
        .set({ name: input.name })
        .where(ownedList(context.auth.userId, input.id))
        .returning()
        .get();
      if (!updated) {
        throw new ORPCError("NOT_FOUND");
      }
      return updated;
    }),
};
