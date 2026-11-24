import { ORPCError } from "@orpc/server";

import type { TmdbLocale } from "./locale";
import type {
  NamedEntity,
  TmdbCredits,
  TmdbImages,
  TmdbLocaleInput,
  TmdbMediaPage,
  TmdbMediaSummary,
  TmdbMovieDetail,
  TmdbSeasonDetail,
  TmdbTitleSummary,
  TmdbTvDetail,
  TmdbWatchProviders,
} from "./schemas";

const TMDB_API_URL = "https://api.themoviedb.org/3";
const DEFAULT_LANGUAGE = "en-US";
const DEFAULT_REGION = "US";
const KNOWN_FOR_LIMIT = 3;

/** Bump when the shape of a cached response changes so old entries are ignored. */
const CACHE_KEY_PREFIX = "tmdb:v1";

const CACHE_TTL_SECONDS = {
  credits: 86_400,
  detail: 86_400,
  discover: 900,
  genres: 86_400,
  images: 86_400,
  search: 3600,
  season: 86_400,
  trending: 900,
  watchProviders: 21_600,
} as const;

/**
 * The slice of Cloudflare KV (or any key/value store) the TMDB cache needs.
 * `KVNamespace` satisfies it as-is.
 */
export interface TmdbCache {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, options: { expirationTtl: number }) => Promise<void>;
}

export interface TmdbClientOptions {
  apiKey: string;
  cache?: TmdbCache | undefined;
  fetch?: typeof fetch | undefined;
  /** Locale for calls that do not pass their own `language` or `region` (D6). */
  locale?: TmdbLocale | undefined;
}

type PageInput = TmdbLocaleInput & {
  page?: number | undefined;
};

type TrendingInput = PageInput & {
  mediaType: "all" | "movie" | "tv";
  window: "day" | "week";
};

type SearchInput = PageInput & {
  query: string;
};

type MediaInput = TmdbLocaleInput & {
  id: number;
};

type SeasonInput = MediaInput & {
  seasonNumber: number;
};

interface RawMediaSummary {
  adult?: boolean;
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  profile_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  known_for?: RawMediaSummary[];
  known_for_department?: string | null;
}

interface RawPage {
  page?: number;
  total_pages?: number;
  total_results?: number;
  results?: RawMediaSummary[];
}

interface RawNamed {
  id?: number;
  name?: string;
}

type RawCompany = RawNamed & {
  logo_path?: string | null;
  origin_country?: string | null;
};

interface RawMovieDetail {
  id: number;
  title?: string;
  original_title?: string;
  overview?: string;
  tagline?: string | null;
  status?: string;
  release_date?: string | null;
  runtime?: number | null;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  budget?: number;
  revenue?: number;
  homepage?: string | null;
  imdb_id?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: RawNamed[];
  spoken_languages?: { code?: string; name?: string }[];
  production_countries?: { iso_3166_1?: string; name?: string }[];
  production_companies?: RawCompany[];
  belongs_to_collection?: {
    id?: number;
    name?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
  } | null;
}

interface RawSeasonSummary {
  id?: number;
  name?: string;
  overview?: string;
  season_number?: number;
  episode_count?: number;
  air_date?: string | null;
  poster_path?: string | null;
}

interface RawTvDetail {
  id: number;
  name?: string;
  original_name?: string;
  created_by?: RawNamed[];
  overview?: string;
  tagline?: string | null;
  status?: string;
  first_air_date?: string | null;
  last_air_date?: string | null;
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  homepage?: string | null;
  in_production?: boolean;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: RawNamed[];
  networks?: RawCompany[];
  seasons?: RawSeasonSummary[];
}

interface RawEpisode {
  id?: number;
  name?: string;
  overview?: string;
  episode_number?: number;
  season_number?: number;
  air_date?: string | null;
  runtime?: number | null;
  vote_average?: number;
  vote_count?: number;
  still_path?: string | null;
}

interface RawSeasonDetail {
  id?: number;
  name?: string;
  overview?: string;
  season_number?: number;
  air_date?: string | null;
  poster_path?: string | null;
  episodes?: RawEpisode[];
}

interface RawCredits {
  id?: number;
  cast?: {
    id?: number;
    name?: string;
    character?: string;
    order?: number;
    profile_path?: string | null;
  }[];
  crew?: {
    id?: number;
    name?: string;
    job?: string;
    department?: string;
    profile_path?: string | null;
  }[];
}

interface RawImage {
  file_path?: string | null;
  width?: number;
  height?: number;
  aspect_ratio?: number;
  iso_639_1?: string | null;
  vote_average?: number;
  vote_count?: number;
}

interface RawImages {
  id?: number;
  posters?: RawImage[];
  backdrops?: RawImage[];
  logos?: RawImage[];
}

interface RawProvider {
  provider_id?: number;
  provider_name?: string;
  logo_path?: string | null;
  display_priority?: number;
}

interface RawProviderGroup {
  link?: string;
  flatrate?: RawProvider[];
  rent?: RawProvider[];
  buy?: RawProvider[];
  free?: RawProvider[];
  ads?: RawProvider[];
}

interface RawWatchProviders {
  id?: number;
  results?: Record<string, RawProviderGroup>;
}

const toNamedList = (items: RawNamed[] | undefined): NamedEntity[] =>
  (items ?? []).map((item) => ({ id: item.id ?? 0, name: item.name ?? "" }));

const toCollection = (
  collection: RawMovieDetail["belongs_to_collection"],
): TmdbMovieDetail["belongsToCollection"] =>
  collection
    ? {
        backdropPath: collection.backdrop_path ?? null,
        id: collection.id ?? 0,
        name: collection.name ?? "",
        posterPath: collection.poster_path ?? null,
      }
    : null;

const toCompanyList = (companies: RawCompany[] | undefined) =>
  (companies ?? []).map((company) => ({
    id: company.id ?? 0,
    logoPath: company.logo_path ?? null,
    name: company.name ?? "",
    originCountry: company.origin_country ?? null,
  }));

const toLanguageList = (languages: { code?: string; name?: string }[] | undefined) =>
  (languages ?? []).map((language) => ({
    code: language.code ?? "",
    name: language.name ?? "",
  }));

const toCountryList = (countries: { iso_3166_1?: string; name?: string }[] | undefined) =>
  (countries ?? []).map((country) => ({
    code: country.iso_3166_1 ?? "",
    name: country.name ?? "",
  }));

const toMovieSummary = (raw: RawMediaSummary): TmdbTitleSummary => ({
  backdropPath: raw.backdrop_path ?? null,
  genreIds: raw.genre_ids ?? [],
  id: raw.id,
  mediaType: "movie",
  overview: raw.overview ?? "",
  popularity: raw.popularity ?? 0,
  posterPath: raw.poster_path ?? null,
  releaseDate: raw.release_date ?? null,
  title: raw.title ?? raw.name ?? "",
  voteAverage: raw.vote_average ?? 0,
  voteCount: raw.vote_count ?? 0,
});

const toTvSummary = (raw: RawMediaSummary): TmdbTitleSummary => ({
  backdropPath: raw.backdrop_path ?? null,
  firstAirDate: raw.first_air_date ?? null,
  genreIds: raw.genre_ids ?? [],
  id: raw.id,
  mediaType: "tv",
  name: raw.name ?? raw.title ?? "",
  overview: raw.overview ?? "",
  popularity: raw.popularity ?? 0,
  posterPath: raw.poster_path ?? null,
  voteAverage: raw.vote_average ?? 0,
  voteCount: raw.vote_count ?? 0,
});

const toKnownFor = (items: RawMediaSummary[]): TmdbTitleSummary[] => {
  const titles: TmdbTitleSummary[] = [];
  for (const item of items) {
    if (item.adult) {
      continue;
    }
    if (item.media_type === "movie") {
      titles.push(toMovieSummary(item));
    } else if (item.media_type === "tv") {
      titles.push(toTvSummary(item));
    }
    if (titles.length === KNOWN_FOR_LIMIT) {
      break;
    }
  }
  return titles;
};

const toPersonSummary = (raw: RawMediaSummary): TmdbMediaSummary => ({
  id: raw.id,
  knownFor: raw.known_for && toKnownFor(raw.known_for),
  knownForDepartment: raw.known_for_department ?? null,
  mediaType: "person",
  name: raw.name ?? "",
  profilePath: raw.profile_path ?? null,
});

const toMediaSummary = (
  raw: RawMediaSummary,
  fallbackMediaType?: "movie" | "tv",
): TmdbMediaSummary | null => {
  switch (raw.media_type ?? fallbackMediaType) {
    case "movie": {
      return toMovieSummary(raw);
    }
    case "tv": {
      return toTvSummary(raw);
    }
    case "person": {
      return toPersonSummary(raw);
    }
    default: {
      return null;
    }
  }
};

const toMediaPage = (raw: RawPage, fallbackMediaType?: "movie" | "tv"): TmdbMediaPage => ({
  page: raw.page ?? 1,
  results: (raw.results ?? []).flatMap((item) => {
    const summary = toMediaSummary(item, fallbackMediaType);
    return summary ? [summary] : [];
  }),
  totalPages: raw.total_pages ?? 0,
  totalResults: raw.total_results ?? 0,
});

const toMovieDetail = (raw: RawMovieDetail): TmdbMovieDetail => ({
  backdropPath: raw.backdrop_path ?? null,
  belongsToCollection: toCollection(raw.belongs_to_collection),
  budget: raw.budget ?? 0,
  genres: toNamedList(raw.genres),
  homepage: raw.homepage ?? null,
  id: raw.id,
  imdbId: raw.imdb_id ?? null,
  originalTitle: raw.original_title ?? raw.title ?? "",
  overview: raw.overview ?? "",
  popularity: raw.popularity ?? 0,
  posterPath: raw.poster_path ?? null,
  productionCompanies: toCompanyList(raw.production_companies),
  productionCountries: toCountryList(raw.production_countries),
  releaseDate: raw.release_date ?? null,
  revenue: raw.revenue ?? 0,
  runtime: raw.runtime ?? null,
  spokenLanguages: toLanguageList(raw.spoken_languages),
  status: raw.status ?? "",
  tagline: raw.tagline ?? null,
  title: raw.title ?? "",
  voteAverage: raw.vote_average ?? 0,
  voteCount: raw.vote_count ?? 0,
});

const toSeasonSummary = (season: RawSeasonSummary) => ({
  airDate: season.air_date ?? null,
  episodeCount: season.episode_count ?? 0,
  id: season.id ?? 0,
  name: season.name ?? "",
  overview: season.overview ?? "",
  posterPath: season.poster_path ?? null,
  seasonNumber: season.season_number ?? 0,
});

const toTvDetail = (raw: RawTvDetail): TmdbTvDetail => ({
  backdropPath: raw.backdrop_path ?? null,
  createdBy: toNamedList(raw.created_by),
  episodeRunTime: raw.episode_run_time ?? [],
  firstAirDate: raw.first_air_date ?? null,
  genres: toNamedList(raw.genres),
  homepage: raw.homepage ?? null,
  id: raw.id,
  inProduction: raw.in_production ?? false,
  lastAirDate: raw.last_air_date ?? null,
  name: raw.name ?? "",
  networks: toCompanyList(raw.networks),
  numberOfEpisodes: raw.number_of_episodes ?? 0,
  numberOfSeasons: raw.number_of_seasons ?? 0,
  originalName: raw.original_name ?? raw.name ?? "",
  overview: raw.overview ?? "",
  popularity: raw.popularity ?? 0,
  posterPath: raw.poster_path ?? null,
  seasons: (raw.seasons ?? []).map(toSeasonSummary),
  status: raw.status ?? "",
  tagline: raw.tagline ?? null,
  voteAverage: raw.vote_average ?? 0,
  voteCount: raw.vote_count ?? 0,
});

const toEpisode = (episode: RawEpisode) => ({
  airDate: episode.air_date ?? null,
  episodeNumber: episode.episode_number ?? 0,
  id: episode.id ?? 0,
  name: episode.name ?? "",
  overview: episode.overview ?? "",
  runtime: episode.runtime ?? null,
  seasonNumber: episode.season_number ?? 0,
  stillPath: episode.still_path ?? null,
  voteAverage: episode.vote_average ?? 0,
  voteCount: episode.vote_count ?? 0,
});

const toSeasonDetail = (raw: RawSeasonDetail): TmdbSeasonDetail => ({
  airDate: raw.air_date ?? null,
  episodes: (raw.episodes ?? []).map(toEpisode),
  id: raw.id ?? 0,
  name: raw.name ?? "",
  overview: raw.overview ?? "",
  posterPath: raw.poster_path ?? null,
  seasonNumber: raw.season_number ?? 0,
});

const toCredits = (raw: RawCredits): TmdbCredits => ({
  cast: (raw.cast ?? []).map((member) => ({
    character: member.character ?? "",
    id: member.id ?? 0,
    name: member.name ?? "",
    order: member.order ?? 0,
    profilePath: member.profile_path ?? null,
  })),
  crew: (raw.crew ?? []).map((member) => ({
    department: member.department ?? "",
    id: member.id ?? 0,
    job: member.job ?? "",
    name: member.name ?? "",
    profilePath: member.profile_path ?? null,
  })),
  id: raw.id ?? 0,
});

const toImage = (image: RawImage) => ({
  aspectRatio: image.aspect_ratio ?? 0,
  filePath: image.file_path ?? "",
  height: image.height ?? 0,
  language: image.iso_639_1 ?? null,
  voteAverage: image.vote_average ?? 0,
  voteCount: image.vote_count ?? 0,
  width: image.width ?? 0,
});

const toImages = (raw: RawImages): TmdbImages => ({
  backdrops: (raw.backdrops ?? []).map(toImage),
  id: raw.id ?? 0,
  logos: (raw.logos ?? []).map(toImage),
  posters: (raw.posters ?? []).map(toImage),
});

const toProvider = (provider: RawProvider) => ({
  displayPriority: provider.display_priority ?? 0,
  logoPath: provider.logo_path ?? null,
  providerId: provider.provider_id ?? 0,
  providerName: provider.provider_name ?? "",
});

const toProviders = (providers: RawProvider[] | undefined) => (providers ?? []).map(toProvider);

const toWatchProviders = (raw: RawWatchProviders, region: string): TmdbWatchProviders => {
  const group = raw.results?.[region];

  return {
    ads: toProviders(group?.ads),
    buy: toProviders(group?.buy),
    flatrate: toProviders(group?.flatrate),
    free: toProviders(group?.free),
    id: raw.id ?? 0,
    link: group?.link ?? null,
    region,
    rent: toProviders(group?.rent),
  };
};

/**
 * Server-side TMDB client. The API key stays in the Worker; callers only ever
 * see the mapped responses, and successful responses are cached for their TTL.
 */
export const createTmdbClient = ({
  apiKey,
  cache,
  fetch: fetchImpl = fetch,
  locale,
}: TmdbClientOptions) => {
  const defaultLanguage = locale?.language ?? DEFAULT_LANGUAGE;
  const defaultRegion = locale?.region ?? DEFAULT_REGION;

  const request = async <Raw, Result>(
    path: string,
    { language = defaultLanguage, ...params }: Record<string, string | number | undefined>,
    ttlSeconds: number,
    map: (raw: Raw) => Result,
  ): Promise<Result> => {
    if (!apiKey) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "TMDB_API_KEY is not configured",
      });
    }

    const url = new URL(`${TMDB_API_URL}${path}`);
    url.searchParams.set("language", String(language));

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    // Build the cache key before the credential is added so it never stores the key.
    // The raw response is cached, so request-specific mapping (such as region) stays per call.
    const cacheKey = `${CACHE_KEY_PREFIX}:${url.pathname}?${url.searchParams.toString()}`;
    const cached = await cache?.get(cacheKey);

    if (cached) {
      return map(JSON.parse(cached) as Raw);
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey.startsWith("eyJ")) {
      // TMDB API Read Access Token (v4).
      headers.Authorization = `Bearer ${apiKey}`;
    } else {
      url.searchParams.set("api_key", apiKey);
    }

    const response = await fetchImpl(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        throw new ORPCError("NOT_FOUND", {
          message: "TMDB resource not found",
        });
      }
      throw new ORPCError("BAD_GATEWAY", {
        message: `TMDB request failed with status ${response.status}`,
      });
    }

    const raw = (await response.json()) as Raw;

    await cache?.put(cacheKey, JSON.stringify(raw), {
      expirationTtl: ttlSeconds,
    });

    return map(raw);
  };

  return {
    genres: {
      movie: ({ language }: TmdbLocaleInput) =>
        request<{ genres?: RawNamed[] }, NamedEntity[]>(
          "/genre/movie/list",
          { language },
          CACHE_TTL_SECONDS.genres,
          (raw) => toNamedList(raw.genres),
        ),

      tv: ({ language }: TmdbLocaleInput) =>
        request<{ genres?: RawNamed[] }, NamedEntity[]>(
          "/genre/tv/list",
          { language },
          CACHE_TTL_SECONDS.genres,
          (raw) => toNamedList(raw.genres),
        ),
    },

    movie: {
      credits: ({ id, language }: MediaInput) =>
        request<RawCredits, TmdbCredits>(
          `/movie/${id}/credits`,
          { language },
          CACHE_TTL_SECONDS.credits,
          toCredits,
        ),

      detail: ({ id, language }: MediaInput) =>
        request<RawMovieDetail, TmdbMovieDetail>(
          `/movie/${id}`,
          { language },
          CACHE_TTL_SECONDS.detail,
          toMovieDetail,
        ),

      images: ({ id, language = defaultLanguage }: MediaInput) =>
        request<RawImages, TmdbImages>(
          `/movie/${id}/images`,
          {
            include_image_language: [...new Set([language.split("-")[0], "en", "null"])].join(","),
            language,
          },
          CACHE_TTL_SECONDS.images,
          toImages,
        ),

      nowPlaying: ({ language, page, region = defaultRegion }: PageInput) =>
        request<RawPage, TmdbMediaPage>(
          "/movie/now_playing",
          { language, page: page ?? 1, region },
          CACHE_TTL_SECONDS.discover,
          (raw) => toMediaPage(raw, "movie"),
        ),

      upcoming: ({ language, page, region = defaultRegion }: PageInput) =>
        request<RawPage, TmdbMediaPage>(
          "/movie/upcoming",
          { language, page: page ?? 1, region },
          CACHE_TTL_SECONDS.discover,
          (raw) => toMediaPage(raw, "movie"),
        ),

      watchProviders: ({ id, language, region = defaultRegion }: MediaInput) =>
        request<RawWatchProviders, TmdbWatchProviders>(
          `/movie/${id}/watch/providers`,
          { language },
          CACHE_TTL_SECONDS.watchProviders,
          (raw) => toWatchProviders(raw, region),
        ),
    },

    search: ({ language, page, query }: SearchInput) =>
      request<RawPage, TmdbMediaPage>(
        "/search/multi",
        { include_adult: "false", language, page: page ?? 1, query },
        CACHE_TTL_SECONDS.search,
        (raw) => toMediaPage(raw),
      ),

    trending: ({ language, mediaType, page, window }: TrendingInput) =>
      request<RawPage, TmdbMediaPage>(
        `/trending/${mediaType}/${window}`,
        { language, page: page ?? 1 },
        CACHE_TTL_SECONDS.trending,
        (raw) => toMediaPage(raw, mediaType === "all" ? undefined : mediaType),
      ),

    tv: {
      credits: ({ id, language }: MediaInput) =>
        request<RawCredits, TmdbCredits>(
          `/tv/${id}/credits`,
          { language },
          CACHE_TTL_SECONDS.credits,
          toCredits,
        ),

      detail: ({ id, language }: MediaInput) =>
        request<RawTvDetail, TmdbTvDetail>(
          `/tv/${id}`,
          { language },
          CACHE_TTL_SECONDS.detail,
          toTvDetail,
        ),

      images: ({ id, language }: MediaInput) =>
        request<RawImages, TmdbImages>(
          `/tv/${id}/images`,
          { language },
          CACHE_TTL_SECONDS.images,
          toImages,
        ),

      onTheAir: ({ language, page }: PageInput) =>
        request<RawPage, TmdbMediaPage>(
          "/tv/on_the_air",
          { language, page: page ?? 1 },
          CACHE_TTL_SECONDS.discover,
          (raw) => toMediaPage(raw, "tv"),
        ),

      season: ({ id, language, seasonNumber }: SeasonInput) =>
        request<RawSeasonDetail, TmdbSeasonDetail>(
          `/tv/${id}/season/${seasonNumber}`,
          { language },
          CACHE_TTL_SECONDS.season,
          toSeasonDetail,
        ),

      watchProviders: ({ id, language, region = defaultRegion }: MediaInput) =>
        request<RawWatchProviders, TmdbWatchProviders>(
          `/tv/${id}/watch/providers`,
          { language },
          CACHE_TTL_SECONDS.watchProviders,
          (raw) => toWatchProviders(raw, region),
        ),
    },
  };
};

export type TmdbClient = ReturnType<typeof createTmdbClient>;
