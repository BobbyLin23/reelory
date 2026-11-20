const POSTER_PATH = /^\/[\w-]+\.[a-zA-Z0-9]+$/u;
const YEAR = /^(?<year>\d{4})/u;
const TMDB_IMAGE = "https://image.tmdb.org/t/p";

export type MediaType = "movie" | "tv";
export type LibraryStatus = "want" | "watching" | "watched";

export const LIBRARY_STATUS_ACTIONS = [
  { label: "Want", status: "want" },
  { label: "Watching", status: "watching" },
  { label: "Watched", status: "watched" },
] as const satisfies readonly { status: LibraryStatus; label: string }[];

export const libraryStatusLabel = (status: LibraryStatus) =>
  LIBRARY_STATUS_ACTIONS.find((action) => action.status === status)?.label ?? status;

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
  size: "w185" | "w500" | "w780" | "original",
): string | null => (path === null ? null : `${TMDB_IMAGE}/${size}${path}`);

export const yearFromDate = (value: string | null): number | null => {
  const year = value === null ? Number.NaN : Number(YEAR.exec(value)?.groups?.year);
  return year >= 1 && year <= 9999 ? year : null;
};

export const formatRuntime = (minutes: number | null | undefined): string | null => {
  if (typeof minutes !== "number" || minutes <= 0) {
    return null;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  if (rest === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${rest}m`;
};

export const formatVote = (value: number): string => value.toFixed(1);

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
