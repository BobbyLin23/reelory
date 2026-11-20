import { expect, test } from "bun:test";

import {
  formatRuntime,
  isMediaType,
  librarySnapshot,
  parseTmdbId,
  ratingToStars,
  starsToRating,
  tmdbImageUrl,
  toIsoDate,
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
