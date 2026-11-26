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
  const migrations = ["20261119121921_melodic_satana", "20261125094326_quick_giant_man"].map(
    (directory) =>
      Bun.file(new URL(`../../../db/src/migrations/${directory}/migration.sql`, import.meta.url)),
  );
  const statements = (await Promise.all(migrations.map((migration) => migration.text()))).flatMap(
    (sql) => sql.split("--> statement-breakpoint").map((statement) => statement.trim()),
  );
  await d1.batch(statements.map((sql) => d1.prepare(sql)));
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
    anonymous.library.removeWant(tv),
    anonymous.library.setStatus({ ...tv, snapshot, status: "watching" }),
    anonymous.watch.list(tv),
    anonymous.watch.log(tv),
    anonymous.watch.markThrough({ ...tv, episodes: [{ episode: 1, season: 1 }] }),
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

test("removes only the caller's Want entry, sparing watches, lists, and newer statuses", async () => {
  const alice = rpc("remove-want-alice");
  const bob = rpc("remove-want-bob");
  const series = { mediaType: "tv", tmdbId: 404 } as const;

  const want = await alice.library.setStatus({ ...series, snapshot, status: "want" });
  const bobWant = await bob.library.setStatus({ ...series, snapshot, status: "want" });
  const watch = await alice.watch.log({ ...series, episode: 1, season: 1 });
  const list = await alice.lists.create({ name: "Private" });
  await alice.lists.addItem({ ...series, listId: list.id });

  expect(want).toMatchObject({ status: "want" });
  expect(await alice.library.removeWant(series)).toEqual({ removed: true });
  expect(await alice.library.list(series)).toEqual([]);
  expect(await alice.watch.list(series)).toEqual([watch]);
  expect(
    (await alice.lists.get({ id: list.id })).items.map(({ mediaType, tmdbId }) => ({
      mediaType,
      tmdbId,
    })),
  ).toEqual([series]);
  // Another user's identical Want entry belongs to them and stays put.
  expect(await bob.library.list(series)).toEqual([bobWant]);

  // A status changed after the dialog opened is newer than the Want entry the confirm described.
  const watched = await alice.library.setStatus({ ...series, snapshot, status: "watched" });
  expect(await alice.library.removeWant(series)).toEqual({ removed: false });
  expect(await alice.library.list(series)).toEqual([watched]);

  // Asking twice, or after the entry is gone, is harmless.
  expect(await alice.library.setStatus({ ...series, snapshot, status: "want" })).toMatchObject({
    status: "want",
  });
  await alice.library.removeWant(series);
  expect(await alice.library.removeWant(series)).toEqual({ removed: false });
  expect(await alice.library.list(series)).toEqual([]);
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
  // A rewatch of an episode already recorded does not count twice toward the bar.
  await alice.watch.log({ ...series, episode: 4, rating: 1, season: 1, watchedOn: "2026-10-01" });
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
    progress: { episode: 1, season: 2, watchedEpisodes: 3 },
  });
  expect(byTitle.get("Film")).toMatchObject({
    latestWatch: { rating: 9, watchedOn: null },
    progress: null,
  });
  expect(byTitle.get("Queued")).toMatchObject({ latestWatch: null, progress: null });
  expect(await bob.library.overview()).toMatchObject({
    counts: { want: 1, watched: 0, watching: 0 },
    entries: [{ progress: { episode: 9, season: 9, watchedEpisodes: 1 } }],
  });
});

test("logs rewatches independently and lets only the owner edit or delete a watch", async () => {
  const alice = rpc("watch-alice");
  const bob = rpc("watch-bob");
  const fields = {
    ...tv,
    episode: 1,
    rating: 9,
    review: "Private",
    season: 0,
    tags: ["IMAX", "with friends"],
    viewingMethod: "cinema" as const,
    watchedOn: null,
  };
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
    tags: [],
    viewingMethod: null,
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
      tags: [],
      viewingMethod: null,
      watchedOn: "2026-11-19",
    }),
  ).toMatchObject({
    episode: 2,
    rating: null,
    review: "Private",
    season: 1,
    tags: [],
    viewingMethod: null,
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

test("marks every missing episode through a target in one request", async () => {
  const alice = rpc("mark-through-alice");
  const bob = rpc("mark-through-bob");
  const series = { mediaType: "tv", tmdbId: 77 } as const;
  const seriesEntry = await alice.library.setStatus({ ...series, snapshot, status: "watching" });

  const first = await alice.watch.markThrough({
    ...series,
    episodes: [
      { episode: 1, season: 1 },
      { episode: 2, season: 1 },
      { episode: 2, season: 1 },
      { episode: 3, season: 1 },
      { episode: 1, season: 2 },
    ],
    watchedOn: "2026-11-18",
  });
  expect(first).toEqual({ created: 4, skipped: 0 });

  const second = await alice.watch.markThrough({
    ...series,
    episodes: [
      { episode: 2, season: 1 },
      { episode: 3, season: 1 },
      { episode: 4, season: 1 },
      { episode: 1, season: 2 },
      { episode: 2, season: 2 },
    ],
    watchedOn: "2026-11-19",
  });
  expect(second).toEqual({ created: 2, skipped: 3 });

  const watches = await alice.watch.list(series);
  expect(watches.map(({ episode, season }) => `${season}:${episode}`).toSorted()).toEqual([
    "1:1",
    "1:2",
    "1:3",
    "1:4",
    "2:1",
    "2:2",
  ]);
  expect(watches.filter((watch) => watch.watchedOn === "2026-11-18")).toHaveLength(4);
  expect(watches.filter((watch) => watch.watchedOn === "2026-11-19")).toHaveLength(2);
  // Filling every episode never infers completion: the user's status is untouched.
  expect(await alice.library.list(series)).toEqual([seriesEntry]);

  // Marking an out-of-order episode with a single log leaves the earlier ones alone.
  const outOfOrder = rpc("mark-through-out-of-order");
  const later = { mediaType: "tv", tmdbId: 78 } as const;
  await outOfOrder.watch.log({ ...later, episode: 5, season: 2, watchedOn: "2026-11-18" });
  expect(await outOfOrder.watch.list(later)).toMatchObject([{ episode: 5, season: 2 }]);

  // Another user buffering the same series gets their own rows and does not move Alice's progress.
  expect(await bob.watch.markThrough({ ...series, episodes: [{ episode: 6, season: 1 }] })).toEqual(
    { created: 1, skipped: 0 },
  );
  expect(await bob.watch.list(series)).toHaveLength(1);
  expect(await alice.watch.list(series)).toHaveLength(6);
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
    // @ts-expect-error Exercise an unknown method at the RPC boundary.
    client.watch.log({ ...movie, viewingMethod: "imax" }),
    client.watch.log({ ...movie, tags: ["ok", ""] }),
    client.watch.log({ ...movie, tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`) }),
    client.watch.markThrough({ ...movie, episodes: [{ episode: 1, season: 1 }] }),
    client.watch.markThrough({ ...tv, episodes: [] }),
    client.watch.markThrough({ ...tv, episodes: [{ episode: 0, season: 1 }] }),
    client.watch.markThrough({ ...tv, episodes: [{ episode: 1, season: -1 }] }),
    client.watch.markThrough({
      ...tv,
      episodes: [{ episode: 1, season: 1 }],
      watchedOn: "2026-13-01",
    }),
    client.watch.markThrough({
      ...tv,
      episodes: Array.from({ length: 501 }, (_, index) => ({ episode: index + 1, season: 1 })),
    }),
    client.watch.update({ id: movieWatch.id, rating: 1.5 }),
    client.watch.update({ episode: null, id: movieWatch.id, review: "Half a patch" }),
    client.watch.update({ episode: 1, id: movieWatch.id, season: 0 }),
    client.watch.update({ id: movieWatch.id }),
  ];
  for (const result of await Promise.allSettled(requests)) {
    expect(result).toMatchObject({ reason: { code: "BAD_REQUEST" }, status: "rejected" });
  }
});

test("adds viewing method and tags without touching existing watches", async () => {
  const legacy = new Miniflare(
    convertV4MiniflareOptions({
      d1Databases: ["DB"],
      modules: true,
      script: "export default {}",
    }),
  );
  try {
    const d1 = await legacy.getD1Database("DB");
    const run = async (directory: string) => {
      const sql = await Bun.file(
        new URL(`../../../db/src/migrations/${directory}/migration.sql`, import.meta.url),
      ).text();
      await d1.batch(
        sql.split("--> statement-breakpoint").map((statement) => d1.prepare(statement.trim())),
      );
    };
    await run("20261119121921_melodic_satana");
    await d1
      .prepare(
        "INSERT INTO watch_entries (created_at, id, media_type, rating, review, tmdb_id, user_id, watched_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        1_700_000_000_000,
        "legacy-watch",
        "movie",
        8,
        "Legacy review",
        42,
        "legacy-user",
        "2020-01-01",
      )
      .run();
    await run("20261125094326_quick_giant_man");
    const row = await d1
      .prepare(
        "SELECT rating, review, tags, viewing_method, watched_on FROM watch_entries WHERE id = ?",
      )
      .bind("legacy-watch")
      .first();
    expect(row).toMatchObject({
      rating: 8,
      review: "Legacy review",
      tags: "[]",
      viewing_method: null,
      watched_on: "2020-01-01",
    });
  } finally {
    await legacy.dispose();
  }
});
