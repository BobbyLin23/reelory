import { afterAll, beforeAll, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { createDb } from "@reelory/db";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import type { Context } from "../context";
import { createTmdbClient } from "../tmdb/client";
import { appRouter } from "./index";
import type { AppRouterClient } from "./index";

const migrations = new URL("../../../db/src/migrations/", import.meta.url);
const miniflare = new Miniflare(
  convertV4MiniflareOptions({
    d1Databases: ["DB"],
    modules: true,
    script: "export default {}",
  }),
);

const tmdb = createTmdbClient({
  apiKey: "unused",
  fetch: Object.assign(
    () => {
      throw new Error("Monthly stats must not call TMDB");
    },
    { preconnect: fetch.preconnect },
  ),
});
const handler = new RPCHandler(appRouter);
let db: Context["db"];

beforeAll(async () => {
  const d1 = await miniflare.getD1Database("DB");
  const statements = readdirSync(migrations)
    .toSorted()
    .flatMap((directory) => {
      const sql = readFileSync(new URL(`${directory}/migration.sql`, migrations), "utf-8");
      return sql.split("--> statement-breakpoint").map((statement) => d1.prepare(statement.trim()));
    });
  await d1.batch(statements);
  db = createDb(d1);
});

afterAll(async () => {
  await miniflare.dispose();
});

const rpc = (userId: string | null): AppRouterClient =>
  createORPCClient(
    new RPCLink({
      fetch: async (request) => {
        const context = { auth: userId ? { userId } : null, db, tmdb };
        const result = await handler.handle(request, { context, prefix: "/rpc" });
        return result.matched ? result.response : new Response(null, { status: 404 });
      },
      url: "http://reelory.test/rpc",
    }),
  );

const snapshot = (title: string, genres: string[]) => ({
  genres,
  posterPath: null,
  title,
  year: 2026,
});

const busyDays = (days: { day: string; watches: number }[]) =>
  days.filter(({ watches }) => watches > 0).map(({ day, watches }) => [day, watches]);

const busyRatings = (ratings: { rating: number; watches: number }[]) =>
  ratings.filter(({ watches }) => watches > 0).map(({ rating, watches }) => [rating, watches]);

test("rejects unauthenticated and malformed monthly requests", async () => {
  const anonymous = rpc(null);
  await expect(anonymous.stats.monthly({ month: "2026-11" })).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });

  const client = rpc("stats-validation");
  const invalid = ["2026-13", "2026-00", "2026-1", "November 2026", "", "2026-11-01"];
  const rejected = invalid.map((month) =>
    expect(client.stats.monthly({ month })).rejects.toMatchObject({ code: "BAD_REQUEST" }),
  );
  await Promise.all(rejected);
});

test("counts each month from episode dates, with undated watches kept separate and private", async () => {
  const alice = rpc("stats-alice");
  const bob = rpc("stats-bob");
  const series = { mediaType: "tv", tmdbId: 101 } as const;
  const film = { mediaType: "movie", tmdbId: 102 } as const;
  const unlistedFilm = { mediaType: "movie", tmdbId: 103 } as const;

  await alice.library.setStatus({
    ...series,
    snapshot: snapshot("Series", ["Drama", "Mystery"]),
    status: "watching",
  });
  await alice.library.setStatus({
    ...film,
    snapshot: snapshot("Film", ["Drama", "Comedy"]),
    status: "watched",
  });
  await bob.library.setStatus({
    ...film,
    snapshot: snapshot("Bob's film", ["Horror"]),
    status: "watched",
  });

  // Three episodes on the first, one on the last day: one series title, four watches.
  await Promise.all(
    [1, 2, 3].map((episode) =>
      alice.watch.log({ ...series, episode, rating: 8, season: 1, watchedOn: "2026-11-01" }),
    ),
  );
  await alice.watch.log({
    ...series,
    episode: 4,
    rating: 9,
    season: 1,
    watchedOn: "2026-11-30",
  });
  // A rewatch and an unrated watch on the same day count as two more watches.
  await alice.watch.log({ ...film, rating: 6, watchedOn: "2026-11-15" });
  await alice.watch.log({ ...film, rating: 10, watchedOn: "2026-11-15" });
  await alice.watch.log({ ...unlistedFilm, watchedOn: "2026-11-15" });
  // Neighbouring months and undated watches stay out of November.
  await alice.watch.log({ ...film, rating: 2, watchedOn: "2026-10-31" });
  await alice.watch.log({ ...film, rating: 1, watchedOn: "2026-12-01" });
  await alice.watch.log({ ...film, rating: 4 });
  await alice.watch.log({ ...series, rating: 5 });

  const november = await alice.stats.monthly({ month: "2026-11" });
  expect(november).toMatchObject({
    films: 2,
    month: "2026-11",
    series: 1,
    titlesWatched: 3,
    undatedWatches: 2,
  });
  // The unlisted film counts as a title, while only saved genres contribute.
  expect(november.genres).toEqual([
    { genre: "Drama", titles: 2 },
    { genre: "Comedy", titles: 1 },
    { genre: "Mystery", titles: 1 },
  ]);
  expect(november.days).toHaveLength(30);
  expect(busyDays(november.days)).toEqual([
    ["2026-11-01", 3],
    ["2026-11-15", 3],
    ["2026-11-30", 1],
  ]);
  expect(november.ratings).toHaveLength(10);
  expect(busyRatings(november.ratings)).toEqual([
    [6, 1],
    [8, 3],
    [9, 1],
    [10, 1],
  ]);

  const october = await alice.stats.monthly({ month: "2026-10" });
  expect(busyDays(october.days)).toEqual([["2026-10-31", 1]]);
  expect(busyRatings(october.ratings)).toEqual([[2, 1]]);
  const december = await alice.stats.monthly({ month: "2026-12" });
  expect(busyDays(december.days)).toEqual([["2026-12-01", 1]]);
  expect(busyRatings(december.ratings)).toEqual([[1, 1]]);

  // Bob's own library and log never leak into Alice's month, or the other way round.
  await bob.watch.log({ ...film, rating: 7, watchedOn: "2026-11-15" });
  await bob.watch.log({ ...film, rating: 3 });
  const bobNovember = await bob.stats.monthly({ month: "2026-11" });
  expect(bobNovember).toMatchObject({
    films: 1,
    series: 0,
    titlesWatched: 1,
    undatedWatches: 1,
  });
  expect(bobNovember.genres).toEqual([{ genre: "Horror", titles: 1 }]);
  expect(busyRatings(bobNovember.ratings)).toEqual([[7, 1]]);
  const aliceAgain = await alice.stats.monthly({ month: "2026-11" });
  expect(busyDays(aliceAgain.days)).toEqual([
    ["2026-11-01", 3],
    ["2026-11-15", 3],
    ["2026-11-30", 1],
  ]);
});

test("returns a complete, empty month with the all-time undated count", async () => {
  const client = rpc("stats-empty");
  await client.watch.log({ mediaType: "movie", rating: 5, tmdbId: 200, watchedOn: "2026-09-01" });
  await client.watch.log({ mediaType: "movie", tmdbId: 201 });

  const empty = await client.stats.monthly({ month: "2026-08" });
  expect(empty).toMatchObject({
    films: 0,
    genres: [],
    month: "2026-08",
    series: 0,
    titlesWatched: 0,
    undatedWatches: 1,
  });
  expect(empty.days).toHaveLength(31);
  expect(empty.days.every(({ watches }) => watches === 0)).toBe(true);
  expect(empty.ratings).toEqual(
    Array.from({ length: 10 }, (_, index) => ({ rating: index + 1, watches: 0 })),
  );

  const february = await client.stats.monthly({ month: "2028-02" });
  expect(february.days).toHaveLength(29);
});
