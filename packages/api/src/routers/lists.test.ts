import { afterAll, beforeAll, expect, test } from "bun:test";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { createDb } from "@reelory/db";
import { listItems } from "@reelory/db/schema";
import { eq } from "drizzle-orm";
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
      throw new Error("Lists must not call TMDB");
    },
    { preconnect: fetch.preconnect },
  ),
});
const handler = new RPCHandler(appRouter);
let db: Context["db"];

beforeAll(async () => {
  const d1 = await miniflare.getD1Database("DB");
  const migrations = [
    "../../../db/src/migrations/20261119121921_melodic_satana/migration.sql",
    "../../../db/src/migrations/20261120070619_regular_post/migration.sql",
    "../../../db/src/migrations/20261125094326_quick_giant_man/migration.sql",
  ];
  const loaded = await Promise.all(
    migrations.map(async (path) => {
      const migration = await Bun.file(new URL(path, import.meta.url)).text();
      return migration.split("--> statement-breakpoint").map((sql) => d1.prepare(sql.trim()));
    }),
  );
  const statements = loaded.flat();
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

const tv = { mediaType: "tv", tmdbId: 42 } as const;
const movie = { mediaType: "movie", tmdbId: 42 } as const;
const snapshot = { genres: ["剧情"], posterPath: "/title.jpg", title: "剧集", year: 2025 };

test("rejects unauthenticated requests to every list procedure", async () => {
  const anonymous = rpc(null);
  const id = crypto.randomUUID();
  const requests = [
    anonymous.lists.overview(),
    anonymous.lists.get({ id }),
    anonymous.lists.create({ name: "Private" }),
    anonymous.lists.rename({ id, name: "Private" }),
    anonymous.lists.delete({ id }),
    anonymous.lists.addItem({ ...tv, listId: id }),
    anonymous.lists.removeItem({ ...tv, listId: id }),
    anonymous.lists.forTitle(tv),
  ];
  for (const result of await Promise.allSettled(requests)) {
    expect(result).toMatchObject({ reason: { code: "UNAUTHORIZED" }, status: "rejected" });
  }
});

test("creates, renames, and deletes lists that only their owner can reach", async () => {
  const alice = rpc("lists-alice");
  const bob = rpc("lists-bob");
  const created = await alice.lists.create({ name: "  Film history  " });
  const bobList = await bob.lists.create({ name: "Bob's list" });

  expect(created).toMatchObject({ name: "Film history" });
  expect(await bob.lists.overview()).toEqual([expect.objectContaining({ id: bobList.id })]);

  const foreignCalls = [
    bob.lists.get({ id: created.id }),
    bob.lists.rename({ id: created.id, name: "Hijacked" }),
    bob.lists.delete({ id: created.id }),
    bob.lists.addItem({ ...tv, listId: created.id }),
    bob.lists.removeItem({ ...tv, listId: created.id }),
  ];
  for (const result of await Promise.allSettled(foreignCalls)) {
    expect(result).toMatchObject({ reason: { code: "NOT_FOUND" }, status: "rejected" });
  }

  expect(await bob.lists.get({ id: bobList.id })).toEqual({
    id: bobList.id,
    items: [],
    name: "Bob's list",
  });
  expect(await alice.lists.get({ id: created.id })).toEqual({
    id: created.id,
    items: [],
    name: "Film history",
  });

  const renamed = await alice.lists.rename({ id: created.id, name: "Cinema canon" });
  expect(renamed).toMatchObject({ id: created.id, name: "Cinema canon" });
  expect(await alice.lists.overview()).toEqual([
    { id: created.id, itemCount: 0, name: "Cinema canon", preview: [] },
  ]);

  await alice.lists.create({ name: "Second list" });
  expect(await alice.lists.overview()).toHaveLength(2);

  await alice.lists.delete({ id: created.id });
  expect(await alice.lists.overview()).toEqual([
    expect.objectContaining({ itemCount: 0, name: "Second list" }),
  ]);
  await expect(alice.lists.get({ id: created.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("rejects a list without a name", async () => {
  const alice = rpc("lists-names");
  await expect(alice.lists.create({ name: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  const list = await alice.lists.create({ name: "Named" });
  await expect(alice.lists.rename({ id: list.id, name: "" })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
});

test("keeps insertion order and never adds the same title twice", async () => {
  const alice = rpc("lists-order");
  const list = await alice.lists.create({ name: "Ordered" });
  const first = { mediaType: "movie", tmdbId: 1 } as const;
  const second = { mediaType: "tv", tmdbId: 2 } as const;
  const third = { mediaType: "movie", tmdbId: 3 } as const;

  expect(await alice.lists.addItem({ ...third, listId: list.id })).toEqual({ added: true });
  expect(await alice.lists.addItem({ ...first, listId: list.id })).toEqual({ added: true });
  expect(await alice.lists.addItem({ ...second, listId: list.id })).toEqual({ added: true });
  expect(await alice.lists.addItem({ ...first, listId: list.id })).toEqual({ added: false });

  const ordered = await alice.lists.get({ id: list.id });
  expect(ordered.items.map(({ mediaType, tmdbId }) => `${mediaType}:${tmdbId}`)).toEqual([
    "movie:3",
    "movie:1",
    "tv:2",
  ]);

  await alice.lists.addItem({ listId: list.id, mediaType: "movie", tmdbId: 4 });
  await alice.lists.addItem({ listId: list.id, mediaType: "movie", tmdbId: 5 });
  await alice.lists.addItem({ listId: list.id, mediaType: "movie", tmdbId: 6 });
  await alice.lists.addItem({ listId: list.id, mediaType: "movie", tmdbId: 7 });
  await alice.lists.addItem({ listId: list.id, mediaType: "movie", tmdbId: 8 });
  const [summary] = await alice.lists.overview();
  expect(summary).toMatchObject({ itemCount: 8 });
  expect(summary?.preview.map(({ tmdbId }) => tmdbId)).toEqual([3, 1, 2, 4]);

  expect(await alice.lists.removeItem({ ...first, listId: list.id })).toEqual({ removed: true });
  expect(await alice.lists.removeItem({ ...first, listId: list.id })).toEqual({ removed: false });
  const remaining = await alice.lists.get({ id: list.id });
  expect(remaining.items.map(({ tmdbId }) => tmdbId)).toEqual([3, 2, 4, 5, 6, 7, 8]);
});

test("marks which of a user's lists hold a title", async () => {
  const alice = rpc("lists-membership");
  const bob = rpc("lists-membership-bob");
  const holds = await alice.lists.create({ name: "Holds it" });
  const empty = await alice.lists.create({ name: "Empty" });
  await bob.lists.create({ name: "Bob's" });
  await alice.lists.addItem({ ...tv, listId: holds.id });

  const membership = await alice.lists.forTitle(tv);
  expect(membership).toHaveLength(2);
  expect(membership).toEqual(
    expect.arrayContaining([
      { hasTitle: true, id: holds.id, name: "Holds it" },
      { hasTitle: false, id: empty.id, name: "Empty" },
    ]),
  );
  expect(await alice.lists.forTitle(movie)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ hasTitle: false, id: holds.id }),
      expect.objectContaining({ hasTitle: false, id: empty.id }),
    ]),
  );
});

test("deleting a list keeps library entries and watch history intact", async () => {
  const alice = rpc("lists-delete");
  await alice.library.setStatus({ ...tv, snapshot, status: "watched" });
  const watch = await alice.watch.log({ ...tv, rating: 9, watchedOn: "2026-11-20" });
  const list = await alice.lists.create({ name: "To delete" });
  await alice.lists.addItem({ ...tv, listId: list.id });
  await alice.lists.addItem({ ...movie, listId: list.id });

  await alice.lists.delete({ id: list.id });

  expect(await alice.library.list({ mediaType: "tv", tmdbId: tv.tmdbId })).toHaveLength(1);
  expect(await alice.watch.list(tv)).toEqual([expect.objectContaining({ id: watch.id })]);
  expect(await alice.lists.overview()).toEqual([]);
  expect(await db.select().from(listItems).where(eq(listItems.listId, list.id))).toHaveLength(0);
});
