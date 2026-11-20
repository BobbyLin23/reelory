import { LIBRARY_STATUSES, libraryEntries, watchEntries } from "@reelory/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { titleKey } from "./title-key";

const status = z.enum(LIBRARY_STATUSES);

const snapshot = z.object({
  genres: z.array(z.string().trim().min(1).max(100)).max(50),
  posterPath: z
    .string()
    .regex(/^\/[\w-]+\.[a-zA-Z0-9]+$/u)
    .max(255)
    .nullable(),
  title: z.string().trim().min(1).max(500),
  year: z.int().min(1).max(9999).nullable(),
});

interface WatchSummary {
  createdAt: Date;
  episode: number | null;
  id: string;
  rating: number | null;
  season: number | null;
  watchedOn: string | null;
}

/** A watch with no remembered day still counts from the day it was logged. */
const watchRecency = (watch: WatchSummary) =>
  `${watch.watchedOn ?? watch.createdAt.toISOString().slice(0, 10)} ${watch.createdAt.toISOString()}`;

const compareWatches = (left: WatchSummary, right: WatchSummary) => {
  const byRecency = watchRecency(left).localeCompare(watchRecency(right));
  return byRecency === 0 ? left.id.localeCompare(right.id) : byRecency;
};

const isFurtherEpisode = (
  candidate: { episode: number; season: number },
  current: { episode: number; season: number },
) =>
  candidate.season > current.season ||
  (candidate.season === current.season && candidate.episode > current.episode);

export const libraryRouter = {
  // Home reads the whole library once: counts for the status tabs, the latest
  // watch for each card, and the furthest episode for the continue-watching rail.
  overview: protectedProcedure.handler(async ({ context }) => {
    const [entries, watches] = await Promise.all([
      context.db
        .select()
        .from(libraryEntries)
        .where(eq(libraryEntries.userId, context.auth.userId))
        .orderBy(
          desc(libraryEntries.updatedAt),
          desc(libraryEntries.createdAt),
          desc(libraryEntries.id),
        ),
      context.db
        .select({
          createdAt: watchEntries.createdAt,
          episode: watchEntries.episode,
          id: watchEntries.id,
          mediaType: watchEntries.mediaType,
          rating: watchEntries.rating,
          season: watchEntries.season,
          tmdbId: watchEntries.tmdbId,
          watchedOn: watchEntries.watchedOn,
        })
        .from(watchEntries)
        .where(eq(watchEntries.userId, context.auth.userId)),
    ]);

    const summaries = new Map<
      string,
      {
        episodes: Set<string>;
        latest: WatchSummary | null;
        progress: { episode: number; season: number } | null;
      }
    >();
    for (const watch of watches) {
      const key = `${watch.mediaType}:${watch.tmdbId}`;
      const summary = summaries.get(key) ?? {
        episodes: new Set<string>(),
        latest: null,
        progress: null,
      };
      if (summary.latest === null || compareWatches(watch, summary.latest) > 0) {
        summary.latest = watch;
      }
      if (watch.season !== null && watch.episode !== null) {
        summary.episodes.add(`${watch.season}:${watch.episode}`);
        if (
          summary.progress === null ||
          isFurtherEpisode({ episode: watch.episode, season: watch.season }, summary.progress)
        ) {
          summary.progress = { episode: watch.episode, season: watch.season };
        }
      }
      summaries.set(key, summary);
    }

    const counts = { want: 0, watched: 0, watching: 0 };
    for (const entry of entries) {
      counts[entry.status] += 1;
    }

    return {
      counts,
      entries: entries.map((entry) => {
        const summary = summaries.get(`${entry.mediaType}:${entry.tmdbId}`);
        return {
          ...entry,
          latestWatch:
            summary?.latest === null || summary?.latest === undefined
              ? null
              : { rating: summary.latest.rating, watchedOn: summary.latest.watchedOn },
          progress:
            summary?.progress === null || summary?.progress === undefined
              ? null
              : { ...summary.progress, watchedEpisodes: summary.episodes.size },
        };
      }),
    };
  }),

  list: protectedProcedure
    .input(
      z
        .object({
          mediaType: titleKey.shape.mediaType.optional(),
          status: status.optional(),
          tmdbId: titleKey.shape.tmdbId.optional(),
        })
        .default({}),
    )
    .handler(({ context, input }) =>
      context.db
        .select()
        .from(libraryEntries)
        .where(
          and(
            eq(libraryEntries.userId, context.auth.userId),
            input.status ? eq(libraryEntries.status, input.status) : undefined,
            input.mediaType ? eq(libraryEntries.mediaType, input.mediaType) : undefined,
            input.tmdbId ? eq(libraryEntries.tmdbId, input.tmdbId) : undefined,
          ),
        )
        .orderBy(
          desc(libraryEntries.updatedAt),
          desc(libraryEntries.createdAt),
          desc(libraryEntries.id),
        ),
    ),

  setStatus: protectedProcedure
    .input(titleKey.extend({ snapshot, status }))
    .handler(({ context, input }) => {
      const values = { ...input.snapshot, status: input.status, updatedAt: new Date() };
      return context.db
        .insert(libraryEntries)
        .values({
          ...values,
          mediaType: input.mediaType,
          tmdbId: input.tmdbId,
          userId: context.auth.userId,
        })
        .onConflictDoUpdate({
          set: values,
          target: [libraryEntries.userId, libraryEntries.tmdbId, libraryEntries.mediaType],
        })
        .returning()
        .get();
    }),
};
