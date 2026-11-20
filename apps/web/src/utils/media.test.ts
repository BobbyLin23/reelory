import { expect, test } from "bun:test";

import {
  episodesThrough,
  formatEpisode,
  formatRuntime,
  furthestEpisode,
  isMediaType,
  librarySnapshot,
  nextEpisode,
  parseTmdbId,
  ratingToStars,
  seriesTotals,
  starsToRating,
  tmdbImageUrl,
  toIsoDate,
  watchedEpisodeCount,
  yearFromDate,
} from "./media";

test("parses title route params and TMDB image paths", () => {
  expect(isMediaType("movie")).toBe(true);
  expect(isMediaType("person")).toBe(false);
  expect(parseTmdbId("550")).toBe(550);
  expect(parseTmdbId("0")).toBeNull();
  expect(tmdbImageUrl("/abc.jpg", "w500")).toBe("https://image.tmdb.org/t/p/w500/abc.jpg");
  expect(tmdbImageUrl(null, "w500")).toBeNull();
});

test("snapshots library metadata and maps half-star ratings to 1-10", () => {
  expect(yearFromDate("1999-10-15")).toBe(1999);
  expect(formatRuntime(142)).toBe("2h 22m");
  expect(starsToRating(4.5)).toBe(9);
  expect(starsToRating(0)).toBeNull();
  expect(ratingToStars(9)).toBe(4.5);
  expect(
    librarySnapshot({
      genres: [{ name: " Drama " }, { name: "" }],
      posterPath: "/poster.jpg",
      title: "  Fight Club  ",
      year: 1999,
    }),
  ).toEqual({
    genres: ["Drama"],
    posterPath: "/poster.jpg",
    title: "Fight Club",
    year: 1999,
  });
  expect(librarySnapshot({ genres: [], posterPath: "poster.jpg", title: " ", year: null })).toEqual(
    {
      genres: [],
      posterPath: null,
      title: "Untitled",
      year: null,
    },
  );
  const date = new Date(2026, 10, 20);
  expect(toIsoDate(date)).toBe("2026-11-20");
});

const seasons = [
  { episodeCount: 3, seasonNumber: 0 },
  { episodeCount: 8, seasonNumber: 1 },
  { episodeCount: 0, seasonNumber: 2 },
  { episodeCount: 10, seasonNumber: 3 },
];

test("counts only regular seasons with episodes, in airing order", () => {
  expect(seriesTotals(seasons)).toEqual({ episodeCount: 18, seasonCount: 2 });
  expect(seriesTotals([])).toEqual({ episodeCount: 0, seasonCount: 0 });
  expect(formatEpisode({ episode: 2, season: 3 })).toBe("S3E2");
});

test("advances one episode, rolls into the next season, and stops at the last episode", () => {
  expect(nextEpisode(seasons, null)).toEqual({ episode: 1, season: 1 });
  expect(nextEpisode(seasons, { episode: 4, season: 1 })).toEqual({ episode: 5, season: 1 });
  // Season 2 has no episodes, so the next episode opens season 3.
  expect(nextEpisode(seasons, { episode: 8, season: 1 })).toEqual({ episode: 1, season: 3 });
  expect(nextEpisode(seasons, { episode: 10, season: 3 })).toBeNull();
  // Specials are not regular progress, so the next episode opens the series proper.
  expect(nextEpisode(seasons, { episode: 2, season: 0 })).toEqual({ episode: 1, season: 1 });
  expect(nextEpisode([], null)).toBeNull();
});

test("fills episodes from the furthest watched one through the target", () => {
  expect(episodesThrough(seasons, { episode: 2, season: 1 }, { episode: 2, season: 3 })).toEqual([
    { episode: 3, season: 1 },
    { episode: 4, season: 1 },
    { episode: 5, season: 1 },
    { episode: 6, season: 1 },
    { episode: 7, season: 1 },
    { episode: 8, season: 1 },
    { episode: 1, season: 3 },
    { episode: 2, season: 3 },
  ]);
  expect(episodesThrough(seasons, null, { episode: 1, season: 3 })).toHaveLength(9);
  // At or behind the furthest episode nothing is filled implicitly.
  expect(episodesThrough(seasons, { episode: 2, season: 3 }, { episode: 2, season: 3 })).toEqual(
    [],
  );
  expect(episodesThrough(seasons, { episode: 2, season: 3 }, { episode: 9, season: 1 })).toEqual(
    [],
  );
  // An episode past the season's end or in a special season is not fillable.
  expect(episodesThrough(seasons, null, { episode: 4, season: 1 })).toHaveLength(4);
  expect(episodesThrough(seasons, null, { episode: 9, season: 1 })).toEqual([]);
  expect(episodesThrough(seasons, null, { episode: 1, season: 0 })).toEqual([]);
});

test("reads the furthest episode and the distinct count from sparse watches", () => {
  const watches = [
    { episode: 9, season: 1 },
    { episode: 2, season: 3 },
    { episode: 9, season: 1 },
    { episode: null, season: null },
    { episode: 4, season: null },
  ];
  expect(furthestEpisode(watches)).toEqual({ episode: 2, season: 3 });
  expect(watchedEpisodeCount(watches)).toBe(2);
  expect(furthestEpisode([])).toBeNull();
  expect(watchedEpisodeCount([])).toBe(0);
});
