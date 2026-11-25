import type { Locale } from "@/i18n/locale";
import { translate } from "@/i18n/messages";

const POSTER_PATH = /^\/[\w-]+\.[a-zA-Z0-9]+$/u;
const YEAR = /^(?<year>\d{4})/u;
const TMDB_IMAGE = "https://image.tmdb.org/t/p";

export type MediaType = "movie" | "tv";
export const LIBRARY_STATUSES = ["want", "watching", "watched"] as const;
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

export const libraryStatusLabel = (status: LibraryStatus, locale: Locale): string =>
  translate(locale, `status.${status}`);

export const isLibraryStatus = (value: string): value is LibraryStatus =>
  LIBRARY_STATUSES.some((status) => status === value);

export const isMediaType = (value: string | undefined): value is MediaType =>
  value === "movie" || value === "tv";

export const parseTmdbId = (value: string | undefined): number | null => {
  if (value === undefined || !/^\d+$/u.test(value)) {
    return null;
  }
  const id = Number(value);
  return id >= 1 ? id : null;
};

export const tmdbImageUrl = (
  path: string | null,
  size: "w185" | "w500" | "w780" | "w1280" | "original",
): string | null => (path === null ? null : `${TMDB_IMAGE}/${size}${path}`);

export const yearFromDate = (value: string | null): number | null => {
  const year = value === null ? Number.NaN : Number(YEAR.exec(value)?.groups?.year);
  return year >= 1 && year <= 9999 ? year : null;
};

export const formatRuntime = (
  minutes: number | null | undefined,
  locale: Locale,
): string | null => {
  if (typeof minutes !== "number" || minutes <= 0) {
    return null;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return translate(locale, "media.minutes", { minutes: rest });
  }
  if (rest === 0) {
    return translate(locale, "media.hours", { hours });
  }
  return translate(locale, "media.hoursMinutes", { hours, minutes: rest });
};

const voteFormats: Record<Locale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat("en", { maximumFractionDigits: 1, minimumFractionDigits: 1 }),
  "zh-CN": new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }),
};

export const formatVote = (value: number, locale: Locale): string =>
  voteFormats[locale].format(value);

export interface EpisodePosition {
  episode: number;
  season: number;
}

export interface SeasonSummary {
  episodeCount: number;
  seasonNumber: number;
}

/** TMDB season summaries without specials (season 0) or announced empty seasons, in order. */
export const regularSeasons = <T extends SeasonSummary>(seasons: readonly T[]): T[] =>
  seasons
    .filter((season) => season.seasonNumber >= 1 && season.episodeCount > 0)
    .toSorted((left, right) => left.seasonNumber - right.seasonNumber);

export const seriesTotals = (
  seasons: readonly SeasonSummary[],
): { episodeCount: number; seasonCount: number } => {
  const regular = regularSeasons(seasons);
  return {
    episodeCount: regular.reduce((total, season) => total + season.episodeCount, 0),
    seasonCount: regular.length,
  };
};

export const formatEpisode = ({ episode, season }: EpisodePosition, locale: Locale): string =>
  translate(locale, "media.episodeShort", { episode, season });

/** Orders episodes the way they air: by season first, then by episode. */
export const compareEpisodes = (left: EpisodePosition, right: EpisodePosition): number =>
  left.season === right.season ? left.episode - right.episode : left.season - right.season;

/**
 * The episode after `progress`, rolling into the next season when the current
 * season ends. Null means the cached season data has no further episode, and
 * the library status stays exactly as the user set it.
 */
export const nextEpisode = (
  seasons: readonly SeasonSummary[],
  progress: EpisodePosition | null,
): EpisodePosition | null => {
  const regular = regularSeasons(seasons);
  const [firstSeason] = regular;
  if (firstSeason === undefined) {
    return null;
  }
  if (progress === null) {
    return { episode: 1, season: firstSeason.seasonNumber };
  }
  const current = regular.find((season) => season.seasonNumber === progress.season);
  if (current !== undefined && progress.episode < current.episodeCount) {
    return { episode: progress.episode + 1, season: progress.season };
  }
  const following = regular.find((season) => season.seasonNumber > progress.season);
  return following === undefined ? null : { episode: 1, season: following.seasonNumber };
};

/**
 * Every episode strictly after `progress` through `target`, resolved from TMDB's
 * season counts. A target at or behind the furthest watched episode yields an
 * empty list, so choosing an earlier episode never fills episodes implicitly.
 */
export const episodesThrough = (
  seasons: readonly SeasonSummary[],
  progress: EpisodePosition | null,
  target: EpisodePosition,
): EpisodePosition[] => {
  if (progress !== null && compareEpisodes(target, progress) <= 0) {
    return [];
  }
  const regular = regularSeasons(seasons);
  const targetSeason = regular.find((season) => season.seasonNumber === target.season);
  if (targetSeason === undefined || target.episode > targetSeason.episodeCount) {
    return [];
  }
  const episodes: EpisodePosition[] = [];
  for (const season of regular) {
    if (season.seasonNumber > target.season) {
      break;
    }
    if (progress !== null && season.seasonNumber < progress.season) {
      continue;
    }
    const from =
      progress !== null && season.seasonNumber === progress.season ? progress.episode + 1 : 1;
    const to = season.seasonNumber === target.season ? target.episode : season.episodeCount;
    for (let episode = from; episode <= to; episode += 1) {
      episodes.push({ episode, season: season.seasonNumber });
    }
  }
  return episodes;
};

/** The furthest episode recorded for a title, which is what "watched through" shows. */
export const furthestEpisode = (
  watches: readonly { episode: number | null; season: number | null }[],
): EpisodePosition | null => {
  let furthest: EpisodePosition | null = null;
  for (const watch of watches) {
    if (watch.episode === null || watch.season === null) {
      continue;
    }
    const position = { episode: watch.episode, season: watch.season };
    if (furthest === null || compareEpisodes(position, furthest) > 0) {
      furthest = position;
    }
  }
  return furthest;
};

/** Distinct episodes watched, so a rewatch does not push progress past the bar. */
export const watchedEpisodeCount = (
  watches: readonly { episode: number | null; season: number | null }[],
): number => {
  const seen = new Set<string>();
  for (const { episode, season } of watches) {
    if (episode !== null && season !== null) {
      seen.add(`${season}:${episode}`);
    }
  }
  return seen.size;
};

export const toIsoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const fromIsoDate = (value: string): Date => {
  const [year = 1970, month = 1, day = 1] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const starsToRating = (stars: number): number | null => {
  if (stars <= 0) {
    return null;
  }
  return Math.min(10, Math.max(1, Math.round(stars * 2)));
};

export const ratingToStars = (rating: number | null): number => (rating === null ? 0 : rating / 2);

const watchDateFormats: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }),
  "zh-CN": new Intl.DateTimeFormat("zh-CN", { day: "numeric", month: "short", year: "numeric" }),
};

export const formatWatchDate = (value: string | null, locale: Locale): string | null => {
  if (value === null) {
    return null;
  }

  return watchDateFormats[locale].format(fromIsoDate(value));
};

/** A 1-10 rating as the half-star value people see, without a trailing zero. */
export const formatStars = (rating: number): string => {
  const stars = ratingToStars(rating);
  return Number.isInteger(stars) ? String(stars) : stars.toFixed(1);
};

export const librarySnapshot = ({
  genres,
  posterPath,
  title,
  year,
}: {
  genres: readonly { name: string }[];
  posterPath: string | null;
  title: string;
  year: number | null;
}) => {
  const trimmedTitle = title.trim().slice(0, 500);
  return {
    genres: genres
      .map((genre) => genre.name.trim())
      .filter(Boolean)
      .slice(0, 50),
    posterPath: posterPath !== null && POSTER_PATH.test(posterPath) ? posterPath : null,
    title: trimmedTitle.length > 0 ? trimmedTitle : "Untitled",
    year,
  };
};
