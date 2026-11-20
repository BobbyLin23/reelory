import { afterAll, beforeAll, expect, test } from "bun:test";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { createDb } from "@reelory/db";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import type { Context } from "../context";
import { createTmdbClient } from "../tmdb/client";
import { appRouter } from "./index";
import type { AppRouterClient } from "./index";

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
      throw new Error("The personal library and watch log must not call TMDB");
    },
    { preconnect: fetch.preconnect },
  ),
});
const handler = new RPCHandler(appRouter);
let db: Context["db"];

beforeAll(async () => {
  const d1 = await miniflare.getD1Database("DB");
  const migration = await Bun.file(
    new URL(
      "../../../db/src/migrations/20261119121921_melodic_satana/migration.sql",
      import.meta.url,
    ),
  ).text();
  await d1.batch(migration.split("--> statement-breakpoint").map((sql) => d1.prepare(sql.trim())));
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

const tv = { mediaType: "tv", tmdbId: 42 } as const;
const movie = { mediaType: "movie", tmdbId: 42 } as const;
const snapshot = { genres: ["剧情"], posterPath: "/title.jpg", title: "剧集", year: 2025 };

test("rejects unauthenticated requests to every new procedure", async () => {
  const anonymous = rpc(null);
  const id = crypto.randomUUID();
  const requests = [
    anonymous.library.list(),
    anonymous.library.overview(),
    anonymous.library.setStatus({ ...tv, snapshot, status: "watching" }),
    anonymous.watch.list(tv),
    anonymous.watch.log(tv),
    anonymous.watch.update({ id, review: "Private" }),
    anonymous.watch.delete({ id }),
  ];
  for (const result of await Promise.allSettled(requests)) {
    expect(result).toMatchObject({ reason: { code: "UNAUTHORIZED" }, status: "rejected" });
  }
});

test("upserts one localized library snapshot per user and title, then filters and sorts it", async () => {
  const alice = rpc("library-alice");
  const bob = rpc("library-bob");
  const first = await alice.library.setStatus({ ...tv, snapshot, status: "want" });
  const otherType = await alice.library.setStatus({ ...movie, snapshot, status: "watching" });
  const otherUser = await bob.library.setStatus({
    ...tv,
    snapshot: { ...snapshot, title: "Bob's title" },
    status: "watched",
  });
  const updated = await alice.library.setStatus({ ...tv, snapshot, status: "watching" });

  expect(updated).toMatchObject({ createdAt: first.createdAt, id: first.id, status: "watching" });
  expect(otherUser.id).not.toBe(first.id);
  const entries = await alice.library.list();
  expect(entries.map(({ id }) => id)).toEqual([updated.id, otherType.id]);
  expect(await alice.library.list({ mediaType: "tv", status: "watching" })).toEqual([updated]);
  expect(await alice.library.list({ mediaType: "tv", status: "watched" })).toEqual([]);
  expect(await alice.library.list({ mediaType: "tv", tmdbId: tv.tmdbId })).toEqual([updated]);
  expect(await alice.library.list({ mediaType: "movie" })).toEqual([otherType]);
  expect(await alice.library.list({ status: "watching" })).toHaveLength(2);
  expect(await bob.library.list()).toEqual([otherUser]);
  expect(updated).toMatchObject(snapshot);
});

test("summarizes counts, the latest watch, and the furthest episode per title", async () => {
  const alice = rpc("overview-alice");
  const bob = rpc("overview-bob");
  const series = { mediaType: "tv", tmdbId: 8 } as const;
  const film = { mediaType: "movie", tmdbId: 9 } as const;
  const queued = { mediaType: "movie", tmdbId: 10 } as const;

  await alice.library.setStatus({
    ...queued,
    snapshot: { ...snapshot, title: "Queued" },
    status: "want",
  });
  await alice.library.setStatus({
    ...film,
    snapshot: { ...snapshot, title: "Film" },
    status: "watched",
  });
  await alice.library.setStatus({
    ...series,
    snapshot: { ...snapshot, title: "Series" },
    status: "watching",
  });
  await bob.library.setStatus({ ...series, snapshot, status: "want" });

  await alice.watch.log({ ...series, episode: 2, rating: 6, season: 1, watchedOn: "2026-11-01" });
  await alice.watch.log({ ...series, episode: 1, rating: 8, season: 2, watchedOn: "2026-11-10" });
  // A backfilled earlier episode is the furthest progress even though a later watch holds the date.
  await alice.watch.log({ ...series, episode: 4, rating: 4, season: 1, watchedOn: "2026-11-05" });
  await alice.watch.log({ ...film, rating: 9, watchedOn: null });
  await bob.watch.log({ ...series, episode: 9, season: 9 });

  const overview = await alice.library.overview();
  expect(overview.counts).toEqual({ want: 1, watched: 1, watching: 1 });
  expect(overview.entries.map(({ id }) => id)).toEqual(
    (await alice.library.list()).map(({ id }) => id),
  );
  const byTitle = new Map(overview.entries.map((entry) => [entry.title, entry]));
  expect(byTitle.get("Series")).toMatchObject({
    latestWatch: { rating: 8, watchedOn: "2026-11-10" },
    progress: { episode: 1, season: 2 },
  });
  expect(byTitle.get("Film")).toMatchObject({
    latestWatch: { rating: 9, watchedOn: null },
    progress: null,
  });
  expect(byTitle.get("Queued")).toMatchObject({ latestWatch: null, progress: null });
  expect(await bob.library.overview()).toMatchObject({
    counts: { want: 1, watched: 0, watching: 0 },
    entries: [{ progress: { episode: 9, season: 9 } }],
  });
});

test("logs rewatches independently and lets only the owner edit or delete a watch", async () => {
  const alice = rpc("watch-alice");
  const bob = rpc("watch-bob");
  const fields = { ...tv, episode: 1, rating: 9, review: "Private", season: 0, watchedOn: null };
  const libraryEntry = await alice.library.setStatus({ ...tv, snapshot, status: "watching" });
  const watch = await alice.watch.log(fields);
  const rewatch = await alice.watch.log({ ...fields, watchedOn: "2024-02-29" });
  const unknown = await bob.watch.log(movie);

  expect(watch).toMatchObject(fields);
  expect(rewatch.id).not.toBe(watch.id);
  expect(rewatch.watchedOn).toBe("2024-02-29");
  const aliceWatches = await alice.watch.list(tv);
  expect(aliceWatches.map(({ id }) => id)).toEqual([rewatch.id, watch.id]);
  expect(await alice.watch.list(movie)).toEqual([]);
  expect(await bob.watch.list(tv)).toEqual([]);
  expect(unknown).toMatchObject({
    episode: null,
    rating: null,
    review: null,
    season: null,
    watchedOn: null,
  });
  const unauthorizedChanges = [watch.id, crypto.randomUUID()].flatMap((id) => [
    bob.watch.update({ id, review: "Not mine" }),
    bob.watch.update({ episode: 2, id, season: 1 }),
    bob.watch.delete({ id }),
  ]);
  for (const result of await Promise.allSettled(unauthorizedChanges)) {
    expect(result).toMatchObject({ reason: { code: "NOT_FOUND" }, status: "rejected" });
  }

  expect(
    await alice.watch.update({
      episode: 2,
      id: watch.id,
      rating: null,
      season: 1,
      watchedOn: "2026-11-19",
    }),
  ).toMatchObject({
    episode: 2,
    rating: null,
    review: "Private",
    season: 1,
    watchedOn: "2026-11-19",
  });
  expect(await alice.watch.delete({ id: watch.id })).toEqual({ id: watch.id });
  await expect(alice.watch.update({ id: watch.id, review: "Deleted" })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(
    await alice.watch.update({
      episode: null,
      id: rewatch.id,
      review: null,
      season: null,
      watchedOn: null,
    }),
  ).toMatchObject({
    episode: null,
    rating: 9,
    review: null,
    season: null,
    watchedOn: null,
  });
  expect(await alice.library.list()).toEqual([libraryEntry]);
});

test("rejects invalid status, watch dates, ratings, and inconsistent episode fields", async () => {
  const client = rpc("validation-user");
  const movieWatch = await client.watch.log(movie);
  const requests = [
    // @ts-expect-error Exercise an untyped caller at the RPC boundary.
    client.library.setStatus({ ...tv, snapshot, status: "dropped" }),
    client.watch.log({ ...movie, watchedOn: "2025-02-29" }),
    client.watch.log({ ...movie, rating: 0 }),
    client.watch.log({ ...movie, rating: 11 }),
    client.watch.log({ ...movie, episode: 1, season: 0 }),
    client.watch.log({ ...tv, episode: 1 }),
    client.watch.update({ id: movieWatch.id, rating: 1.5 }),
    client.watch.update({ episode: null, id: movieWatch.id, review: "Half a patch" }),
    client.watch.update({ episode: 1, id: movieWatch.id, season: 0 }),
    client.watch.update({ id: movieWatch.id }),
  ];
  for (const result of await Promise.allSettled(requests)) {
    expect(result).toMatchObject({ reason: { code: "BAD_REQUEST" }, status: "rejected" });
  }
});
