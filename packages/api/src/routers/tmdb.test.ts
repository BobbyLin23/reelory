import { expect, test } from "bun:test";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RPCHandler } from "@orpc/server/fetch";

import type { Context } from "../context";
import { createTmdbClient } from "../tmdb/client";
import { appRouter } from "./index";
import type { AppRouterClient } from "./index";

const cn = { language: "zh-CN", region: "CN" };
const us = { language: "en-US", region: "US" };
const id = 11;

const setup = (reply: (url: URL) => object) => {
  const stored = new Map<string, string>();
  const ttls = new Map<string, number>();
  const requests: URL[] = [];
  const apiKey = "test-tmdb-credential";
  const tmdb = createTmdbClient({
    apiKey,
    cache: {
      get: (key) => Promise.resolve(stored.get(key) ?? null),
      put: (key, value, { expirationTtl }) => {
        stored.set(key, value);
        ttls.set(key, expirationTtl);
        return Promise.resolve();
      },
    },
    fetch: Object.assign(
      (input: Parameters<typeof fetch>[0]) => {
        const url = new URL(input.toString());
        requests.push(url);
        return Promise.resolve(Response.json(reply(url)));
      },
      { preconnect: fetch.preconnect },
    ),
  });
  const context = { auth: null, db: {} as Context["db"], tmdb };
  const handler = new RPCHandler(appRouter);
  const link = new RPCLink({
    fetch: async (request) => {
      const result = await handler.handle(request, { context, prefix: "/rpc" });
      return result.matched ? result.response : new Response(null, { status: 404 });
    },
    url: "http://reelory.test/rpc",
  });
  const client: AppRouterClient = createORPCClient(link);
  return { apiKey, requests, rpc: client.tmdb, ttls };
};

test("localizes movie titles without mixing caches or changing the default US result", async () => {
  const { apiKey, requests, rpc, ttls } = setup((url) => ({
    id,
    title: url.searchParams.get("language") === "zh-CN" ? "星球大战" : "Star Wars",
  }));

  const legacy = await rpc.movie.detail({ id });
  expect(legacy.title).toBe("Star Wars");
  expect(await rpc.movie.detail({ id, ...cn })).toMatchObject({ title: "星球大战" });
  expect(await rpc.movie.detail({ id, ...us })).toEqual(legacy);
  expect(await rpc.movie.detail({ id, ...cn })).toMatchObject({ title: "星球大战" });
  expect(requests).toHaveLength(2);
  for (const url of requests) {
    expect(url.origin).toBe("https://api.themoviedb.org");
    expect(url.searchParams.get("api_key")).toBe(apiKey);
  }
  expect(Object.fromEntries(ttls)).toEqual({
    "tmdb:v1:/3/movie/11?language=en-US": 86_400,
    "tmdb:v1:/3/movie/11?language=zh-CN": 86_400,
  });
});

test("includes fallback poster art alongside the localized movie image catalog", async () => {
  const { rpc } = setup((url) => ({
    id,
    posters: [
      { file_path: "/chinese.jpg", iso_639_1: "zh" },
      { file_path: "/english.jpg", iso_639_1: "en" },
      { file_path: "/textless.jpg", iso_639_1: null },
      { file_path: "/french.jpg", iso_639_1: "fr" },
    ].filter(({ iso_639_1 }) =>
      url.searchParams.get("include_image_language")?.split(",").includes(String(iso_639_1)),
    ),
  }));

  const { posters } = await rpc.movie.images({ id, language: "zh-CN" });
  expect(posters.map(({ filePath }) => filePath)).toEqual([
    "/chinese.jpg",
    "/english.jpg",
    "/textless.jpg",
  ]);
});

test("selects the requested provider region on both cache misses and hits", async () => {
  const { requests, rpc, ttls } = setup(() => ({
    id,
    results: {
      CN: { flatrate: [{ provider_id: 1, provider_name: "优酷" }] },
      US: { flatrate: [{ provider_id: 2, provider_name: "Disney Plus" }] },
    },
  }));

  const checkRegion = async (watchProviders: typeof rpc.movie.watchProviders) => {
    const legacy = await watchProviders({ id });
    expect(legacy).toMatchObject({ flatrate: [{ providerName: "Disney Plus" }], region: "US" });
    expect(await watchProviders({ id, region: "CN" })).toMatchObject({
      flatrate: [{ providerName: "优酷" }],
      region: "CN",
    });
    expect(await watchProviders({ id, ...us })).toEqual(legacy);
    expect(await watchProviders({ id, ...cn })).toMatchObject({
      flatrate: [{ providerName: "优酷" }],
      region: "CN",
    });
  };
  await checkRegion(rpc.movie.watchProviders);
  await checkRegion(rpc.tv.watchProviders);
  expect(requests).toHaveLength(4);
  expect([...ttls.values()]).toEqual([21_600, 21_600, 21_600, 21_600]);
});

test("serves paged Discover feeds and localized genre lists through RPC", async () => {
  const { requests, rpc } = setup((url) => {
    const chinese = url.searchParams.get("language") === "zh-CN";
    if (url.pathname.includes("/genre/")) {
      return { genres: [{ id: 18, name: chinese ? "剧情" : "Drama" }] };
    }
    return {
      page: Number(url.searchParams.get("page")),
      results: [{ id, name: "电视节目", title: url.searchParams.get("region") }],
      total_pages: 8,
      total_results: 150,
    };
  });

  expect(await rpc.movie.upcoming({ ...cn, page: 2 })).toMatchObject({
    page: 2,
    results: [{ mediaType: "movie", title: "CN" }],
    totalPages: 8,
    totalResults: 150,
  });
  expect(await rpc.movie.upcoming({ ...cn, page: 2, region: "US" })).toMatchObject({
    results: [{ title: "US" }],
  });
  expect(await rpc.movie.nowPlaying()).toMatchObject({
    page: 1,
    results: [{ mediaType: "movie", title: "US" }],
  });
  expect(await rpc.tv.onTheAir(cn)).toMatchObject({
    page: 1,
    results: [{ mediaType: "tv", name: "电视节目" }],
  });
  // Trending keeps the window in the path; TMDB treats `?window=` as a 404.
  expect(await rpc.trending({ ...cn, mediaType: "all", window: "day" })).toMatchObject({
    page: 1,
  });
  expect(await rpc.trending({ mediaType: "movie", window: "week" })).toMatchObject({
    page: 1,
    results: [{ mediaType: "movie" }],
  });
  expect(await rpc.genres.movie(cn)).toEqual([{ id: 18, name: "剧情" }]);
  expect(await rpc.genres.tv()).toEqual([{ id: 18, name: "Drama" }]);
  expect(requests.map((url) => url.pathname)).toEqual([
    "/3/movie/upcoming",
    "/3/movie/upcoming",
    "/3/movie/now_playing",
    "/3/tv/on_the_air",
    "/3/trending/all/day",
    "/3/trending/movie/week",
    "/3/genre/movie/list",
    "/3/genre/tv/list",
  ]);
});

test("returns typed BAD_REQUEST errors before reaching TMDB for invalid locales", async () => {
  const { requests, rpc } = setup(() => ({}));

  await expect(rpc.movie.detail({ id, language: "xx-CN" })).rejects.toMatchObject({
    code: "BAD_REQUEST",
    status: 400,
  });
  await expect(rpc.genres.tv({ language: "zh_CN" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(rpc.tv.onTheAir({ region: "ZZ" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await expect(rpc.search({ language: "en-ZZ", query: "Star Wars" })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  expect(requests).toHaveLength(0);
});

test("returns bounded film and series highlights for an actor from one cached multi-search", async () => {
  const { requests, rpc, ttls } = setup(() => ({
    results: [
      {
        id: 42,
        known_for: [
          { adult: true, id: 20, media_type: "movie", title: "Excluded" },
          { id: 21, media_type: "person", name: "Not a title" },
          { id: 22, media_type: "movie", title: "沙丘" },
          { id: 22, media_type: "tv", name: "亢奋" },
          { id: 23, media_type: "tv", name: "Another series" },
          { id: 24, media_type: "movie", title: "Over the limit" },
        ],
        known_for_department: "Acting",
        media_type: "person",
        name: "Zendaya",
      },
    ],
  }));

  const first = await rpc.search({ ...cn, query: "Zendaya" });
  expect(first.results).toMatchObject([
    {
      knownFor: [
        { id: 22, mediaType: "movie", title: "沙丘" },
        { id: 22, mediaType: "tv", name: "亢奋" },
        { id: 23, mediaType: "tv" },
      ],
      mediaType: "person",
      name: "Zendaya",
    },
  ]);
  expect(await rpc.search({ ...cn, query: " Zendaya " })).toEqual(first);
  expect(requests.map((url) => url.pathname)).toEqual(["/3/search/multi"]);
  expect(requests[0]?.searchParams.get("language")).toBe("zh-CN");
  expect(requests[0]?.searchParams.get("include_adult")).toBe("false");
  expect([...ttls.values()]).toEqual([3600]);
});
