import { libraryEntries, watchEntries } from "@reelory/db/schema";
import { and, count, eq, gte, isNull, lt } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

const month = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/u, { message: "Use a month like 2026-11." });

const monthBounds = (value: string) => {
  const year = Number(value.slice(0, 4));
  const monthIndex = Number(value.slice(5, 7)) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  return {
    days: Array.from({ length: dayCount }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return { day: `${value}-${day}`, watches: 0 };
    }),
    end: end.toISOString().slice(0, 10),
    start: start.toISOString().slice(0, 10),
  };
};

const titleKey = (entry: { mediaType: string; tmdbId: number }) =>
  `${entry.mediaType}:${entry.tmdbId}`;

export const statsRouter = {
  // Watches are the unit for days and ratings, so every episode of a binge lands on
  // its own date. Titles, the film/series split, and genres count each title once.
  monthly: protectedProcedure.input(z.object({ month })).handler(async ({ context, input }) => {
    const { days, end, start } = monthBounds(input.month);
    const [watches, undated] = await Promise.all([
      context.db
        .select({
          mediaType: watchEntries.mediaType,
          rating: watchEntries.rating,
          tmdbId: watchEntries.tmdbId,
          watchedOn: watchEntries.watchedOn,
        })
        .from(watchEntries)
        .where(
          and(
            eq(watchEntries.userId, context.auth.userId),
            gte(watchEntries.watchedOn, start),
            lt(watchEntries.watchedOn, end),
          ),
        ),
      context.db
        .select({ total: count() })
        .from(watchEntries)
        .where(and(eq(watchEntries.userId, context.auth.userId), isNull(watchEntries.watchedOn)))
        .get(),
    ]);

    const titles = new Map<string, (typeof watches)[number]["mediaType"]>();
    const byDay = new Map(days.map(({ day }) => [day, 0]));
    const byRating = new Map<number, number>();

    for (const watch of watches) {
      titles.set(titleKey(watch), watch.mediaType);
      if (watch.watchedOn !== null) {
        byDay.set(watch.watchedOn, (byDay.get(watch.watchedOn) ?? 0) + 1);
      }
      if (watch.rating !== null) {
        byRating.set(watch.rating, (byRating.get(watch.rating) ?? 0) + 1);
      }
    }

    const genresByTitle = new Map<string, string[]>();
    if (titles.size > 0) {
      const entries = await context.db
        .select({
          genres: libraryEntries.genres,
          mediaType: libraryEntries.mediaType,
          tmdbId: libraryEntries.tmdbId,
        })
        .from(libraryEntries)
        .where(eq(libraryEntries.userId, context.auth.userId));
      for (const entry of entries) {
        genresByTitle.set(titleKey(entry), entry.genres);
      }
    }

    const byGenre = new Map<string, number>();
    for (const key of titles.keys()) {
      const genres = genresByTitle.get(key);
      if (genres === undefined) {
        continue;
      }
      // A title counts once per genre even when it carries the name twice.
      for (const genre of new Set(genres)) {
        byGenre.set(genre, (byGenre.get(genre) ?? 0) + 1);
      }
    }

    const mediaTypes = [...titles.values()];
    return {
      days: days.map(({ day }) => ({ day, watches: byDay.get(day) ?? 0 })),
      films: mediaTypes.filter((mediaType) => mediaType === "movie").length,
      genres: [...byGenre]
        .map(([genre, total]) => ({ genre, titles: total }))
        .toSorted(
          (left, right) => right.titles - left.titles || left.genre.localeCompare(right.genre),
        ),
      month: input.month,
      ratings: Array.from({ length: 10 }, (_, index) => ({
        rating: index + 1,
        watches: byRating.get(index + 1) ?? 0,
      })),
      series: mediaTypes.filter((mediaType) => mediaType === "tv").length,
      titlesWatched: titles.size,
      undatedWatches: undated?.total ?? 0,
    };
  }),
};
