import { ORPCError } from "@orpc/server";
import { VIEWING_METHODS, watchEntries } from "@reelory/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { titleKey } from "./title-key";

const MAX_TAGS = 20;

const tag = z.string().trim().min(1).max(50);

const watchFields = z.object({
  episode: z.int().positive().nullish(),
  rating: z.int().min(1).max(10).nullish(),
  review: z.string().max(10_000).nullish(),
  season: z.int().nonnegative().nullish(),
  tags: z.array(tag).max(MAX_TAGS).nullish(),
  viewingMethod: z.enum(VIEWING_METHODS).nullish(),
  watchedOn: z.iso.date().nullish(),
});

const pairedEpisode = ({ season, episode }: z.infer<typeof watchFields>) =>
  (typeof season === "number") === (typeof episode === "number");

const ownedWatch = (id: string, userId: string) =>
  and(eq(watchEntries.id, id), eq(watchEntries.userId, userId));

const episodeKey = ({ episode, season }: { episode: number; season: number }) =>
  `${season}:${episode}`;

/** D1 accepts 100 bound parameters per statement, so a full season fills in small inserts. */
const ROWS_PER_INSERT = 10;

const MAX_EPISODES_PER_REQUEST = 500;

export const watchRouter = {
  delete: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const deleted = await context.db
        .delete(watchEntries)
        .where(ownedWatch(input.id, context.auth.userId))
        .returning({ id: watchEntries.id })
        .get();
      if (!deleted) {
        throw new ORPCError("NOT_FOUND");
      }
      return deleted;
    }),

  list: protectedProcedure.input(titleKey).handler(({ context, input }) =>
    context.db
      .select()
      .from(watchEntries)
      .where(
        and(
          eq(watchEntries.userId, context.auth.userId),
          eq(watchEntries.tmdbId, input.tmdbId),
          eq(watchEntries.mediaType, input.mediaType),
        ),
      )
      .orderBy(desc(watchEntries.watchedOn), desc(watchEntries.createdAt), desc(watchEntries.id)),
  ),

  log: protectedProcedure
    .input(
      titleKey
        .extend(watchFields.shape)
        .refine(pairedEpisode, { message: "Provide both season and episode, or neither." })
        .refine(({ mediaType, season }) => mediaType === "tv" || typeof season !== "number", {
          message: "Only TV watches can have a season and episode.",
        }),
    )
    .handler(({ context, input }) =>
      context.db
        .insert(watchEntries)
        .values({
          ...input,
          tags: input.tags ?? [],
          userId: context.auth.userId,
        })
        .returning()
        .get(),
    ),

  // Bulk marking fills the gap between what a user has watched and the episode they
  // pick. The caller resolves the range from TMDB's cached season data; this writes
  // one row per missing episode and skips any episode already recorded, so asking
  // twice never duplicates rows.
  markThrough: protectedProcedure
    .input(
      titleKey
        .extend({
          episodes: z
            .array(
              z.object({
                episode: z.int().positive(),
                season: z.int().nonnegative(),
              }),
            )
            .min(1)
            .max(MAX_EPISODES_PER_REQUEST),
          watchedOn: z.iso.date().nullish(),
        })
        .refine(({ mediaType }) => mediaType === "tv", {
          message: "Only series have episodes to mark through.",
        }),
    )
    .handler(async ({ context, input }) => {
      const existing = await context.db
        .select({ episode: watchEntries.episode, season: watchEntries.season })
        .from(watchEntries)
        .where(
          and(
            eq(watchEntries.userId, context.auth.userId),
            eq(watchEntries.tmdbId, input.tmdbId),
            eq(watchEntries.mediaType, input.mediaType),
          ),
        );
      const recorded = new Set(
        existing.flatMap(({ episode, season }) =>
          season === null || episode === null ? [] : [episodeKey({ episode, season })],
        ),
      );
      const requested = new Map(
        input.episodes.map((episode) => [episodeKey(episode), episode] as const),
      );
      const missing = [...requested.values()].filter(
        (episode) => !recorded.has(episodeKey(episode)),
      );

      let created = 0;
      for (let index = 0; index < missing.length; index += ROWS_PER_INSERT) {
        const rows = await context.db
          .insert(watchEntries)
          .values(
            missing.slice(index, index + ROWS_PER_INSERT).map(({ episode, season }) => ({
              episode,
              mediaType: input.mediaType,
              season,
              tmdbId: input.tmdbId,
              userId: context.auth.userId,
              watchedOn: input.watchedOn ?? null,
            })),
          )
          .returning({ id: watchEntries.id });
        created += rows.length;
      }

      return { created, skipped: requested.size - created };
    }),

  update: protectedProcedure
    .input(
      watchFields
        .extend({ id: z.uuid() })
        .refine(
          ({ season, episode }) =>
            pairedEpisode({ episode, season }) &&
            (season === undefined) === (episode === undefined),
          {
            message: "Set or clear season and episode together.",
          },
        )
        .refine(
          ({ episode, rating, review, season, tags, viewingMethod, watchedOn }) =>
            [episode, rating, review, season, tags, viewingMethod, watchedOn].some(
              (value) => value !== undefined,
            ),
          { message: "Provide at least one field to update." },
        ),
    )
    .handler(async ({ context, input: { id, ...rest } }) => {
      const { tags, ...changes } = rest;
      const values = tags === undefined ? changes : { ...changes, tags: tags ?? [] };
      const where = ownedWatch(id, context.auth.userId);
      if (typeof changes.season === "number") {
        const row = await context.db
          .select({ mediaType: watchEntries.mediaType })
          .from(watchEntries)
          .where(where)
          .get();
        if (!row) {
          throw new ORPCError("NOT_FOUND");
        }
        if (row.mediaType !== "tv") {
          throw new ORPCError("BAD_REQUEST", {
            message: "Only TV watches can have a season and episode.",
          });
        }
      }
      const updated = await context.db
        .update(watchEntries)
        .set(values)
        .where(where)
        .returning()
        .get();
      if (!updated) {
        throw new ORPCError("NOT_FOUND");
      }
      return updated;
    }),
};
