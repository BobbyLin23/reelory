import { afterAll, beforeAll, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { createDb } from "@reelory/db";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

import type { Context } from "../context";
import { resolveUserLocale } from "../preferences";
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

/** Records the URL each TMDB call would fetch and answers with Chinese data. */
const stubTmdb = () => {
  const requests: URL[] = [];
  const stub = Object.assign(
    (input: Parameters<typeof fetch>[0]) => {
      const url = new URL(input.toString());
      requests.push(url);
      return Promise.resolve(
        Response.json({
          id: 550,
          results: { CN: { flatrate: [{ provider_id: 1, provider_name: "优酷" }] } },
          title: url.searchParams.get("language") === "zh-CN" ? "搏击俱乐部" : "Fight Club",
        }),
      );
    },
    { preconnect: fetch.preconnect },
  );
  return { requests, stub };
};

const handler = new RPCHandler(appRouter);
let db: Context["db"];

beforeAll(async () => {
  const d1 = await miniflare.getD1Database("DB");
  const statements = readdirSync(migrations)
    .sort()
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
        const tmdb = createTmdbClient({
          apiKey: "unused",
          fetch: Object.assign(
            () => {
              throw new Error("Saving a preference must not call TMDB");
            },
            { preconnect: fetch.preconnect },
          ),
        });
        const context = { auth: userId ? { userId } : null, db, tmdb };
        const result = await handler.handle(request, { context, prefix: "/rpc" });
        return result.matched ? result.response : new Response(null, { status: 404 });
      },
      url: "http://reelory.test/rpc",
    }),
  );

test("keeps preferences private to their user", async () => {
  const anonymous = rpc(null);
  for (const result of await Promise.allSettled([
    anonymous.preferences.get(),
    anonymous.preferences.set({ region: "CN" }),
  ])) {
    expect(result).toMatchObject({ reason: { code: "UNAUTHORIZED" }, status: "rejected" });
  }

  const alice = rpc("preferences-alice");
  const bob = rpc("preferences-bob");
  expect(await alice.preferences.get()).toBeNull();
  expect(await alice.preferences.set({ language: "zh-CN" })).toEqual({
    language: "zh-CN",
    region: null,
  });
  expect(await bob.preferences.get()).toBeNull();
});

test("saves each preference on its own without clearing the other", async () => {
  const client = rpc("preferences-carol");

  expect(await client.preferences.set({ language: "zh-TW" })).toEqual({
    language: "zh-TW",
    region: null,
  });
  expect(await client.preferences.set({ region: "TW" })).toEqual({
    language: "zh-TW",
    region: "TW",
  });
  expect(await client.preferences.set({ language: "en", region: "GB" })).toEqual({
    language: "en",
    region: "GB",
  });
  expect(await client.preferences.get()).toEqual({ language: "en", region: "GB" });
});

test("rejects codes TMDB cannot serve", async () => {
  const client = rpc("preferences-dave");
  for (const result of await Promise.allSettled([
    client.preferences.set({ language: "xx-YY" }),
    client.preferences.set({ language: "english" }),
    client.preferences.set({ region: "ZZ" }),
    client.preferences.set({ region: "china" }),
    client.preferences.set({}),
  ])) {
    expect(result).toMatchObject({ reason: { code: "BAD_REQUEST" }, status: "rejected" });
  }
  expect(await client.preferences.get()).toBeNull();
});

test("uses the saved preference over the request locale, and the request locale otherwise", async () => {
  const saved = await rpc("preferences-erin").preferences.set({ language: "zh-CN", region: "CN" });

  expect(saved).toEqual({ language: "zh-CN", region: "CN" });
  expect(
    await resolveUserLocale({
      acceptLanguage: "en-GB,en;q=0.9",
      db,
      userId: "preferences-erin",
    }),
  ).toEqual({ language: "zh-CN", region: "CN" });
  expect(await resolveUserLocale({ acceptLanguage: "en-GB,en;q=0.9", db, userId: null })).toEqual({
    language: "en",
    region: "GB",
  });
  expect(
    await resolveUserLocale({ acceptLanguage: null, db, userId: "preferences-frank" }),
  ).toEqual({ language: "en-US", region: "US" });
});

test("sends a saved preference to TMDB for both metadata and provider region", async () => {
  const before = await resolveUserLocale({
    acceptLanguage: "en-US,en;q=0.9",
    db,
    userId: "preferences-grace",
  });
  await rpc("preferences-grace").preferences.set({ language: "zh-CN", region: "CN" });
  const after = await resolveUserLocale({
    acceptLanguage: "en-US,en;q=0.9",
    db,
    userId: "preferences-grace",
  });
  const { requests, stub } = stubTmdb();
  const tmdb = createTmdbClient({ apiKey: "unused", fetch: stub, locale: after });

  expect(before).toEqual({ language: "en", region: "US" });
  expect(after).toEqual({ language: "zh-CN", region: "CN" });
  expect(await tmdb.movie.detail({ id: 550 })).toMatchObject({ title: "搏击俱乐部" });
  expect(await tmdb.movie.watchProviders({ id: 550 })).toMatchObject({
    flatrate: [{ providerName: "优酷" }],
    region: "CN",
  });
  expect(requests.map((url) => url.searchParams.get("language"))).toEqual(["zh-CN", "zh-CN"]);
  expect(await tmdb.movie.detail({ id: 550, language: "en-US" })).toMatchObject({
    title: "Fight Club",
  });
});
