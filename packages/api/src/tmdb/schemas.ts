import { z } from "zod";

const tmdbId = z.number().int().positive();
const imagePath = z.string().nullable();
const isoDate = z.string().nullable();

export const namedEntitySchema = z.object({
  id: tmdbId,
  name: z.string(),
});
export type NamedEntity = z.infer<typeof namedEntitySchema>;

const movieSummarySchema = z.object({
  backdropPath: imagePath,
  genreIds: z.array(z.number().int()),
  id: tmdbId,
  mediaType: z.literal("movie"),
  overview: z.string(),
  popularity: z.number(),
  posterPath: imagePath,
  releaseDate: isoDate,
  title: z.string(),
  voteAverage: z.number(),
  voteCount: z.number().int(),
});

const tvSummarySchema = z.object({
  backdropPath: imagePath,
  firstAirDate: isoDate,
  genreIds: z.array(z.number().int()),
  id: tmdbId,
  mediaType: z.literal("tv"),
  name: z.string(),
  overview: z.string(),
  popularity: z.number(),
  posterPath: imagePath,
  voteAverage: z.number(),
  voteCount: z.number().int(),
});

const personSummarySchema = z.object({
  id: tmdbId,
  knownForDepartment: z.string().nullable(),
  mediaType: z.literal("person"),
  name: z.string(),
  profilePath: imagePath,
});

/** A movie, show, or person as it appears in search and trending results. */
export const mediaSummarySchema = z.discriminatedUnion("mediaType", [
  movieSummarySchema,
  tvSummarySchema,
  personSummarySchema,
]);
export type TmdbMediaSummary = z.infer<typeof mediaSummarySchema>;

export const mediaPageSchema = z.object({
  page: z.number().int(),
  results: z.array(mediaSummarySchema),
  totalPages: z.number().int(),
  totalResults: z.number().int(),
});
export type TmdbMediaPage = z.infer<typeof mediaPageSchema>;

const languageSchema = z.object({
  code: z.string(),
  name: z.string(),
});

const countrySchema = z.object({
  code: z.string(),
  name: z.string(),
});

const companySchema = z.object({
  id: tmdbId,
  logoPath: imagePath,
  name: z.string(),
  originCountry: z.string().nullable(),
});

const collectionSchema = z.object({
  backdropPath: imagePath,
  id: tmdbId,
  name: z.string(),
  posterPath: imagePath,
});

export const movieDetailSchema = z.object({
  backdropPath: imagePath,
  belongsToCollection: collectionSchema.nullable(),
  budget: z.number().int(),
  genres: z.array(namedEntitySchema),
  homepage: z.string().nullable(),
  id: tmdbId,
  imdbId: z.string().nullable(),
  originalTitle: z.string(),
  overview: z.string(),
  popularity: z.number(),
  posterPath: imagePath,
  productionCompanies: z.array(companySchema),
  productionCountries: z.array(countrySchema),
  releaseDate: isoDate,
  revenue: z.number().int(),
  runtime: z.number().int().nullable(),
  spokenLanguages: z.array(languageSchema),
  status: z.string(),
  tagline: z.string().nullable(),
  title: z.string(),
  voteAverage: z.number(),
  voteCount: z.number().int(),
});
export type TmdbMovieDetail = z.infer<typeof movieDetailSchema>;

const seasonSummarySchema = z.object({
  airDate: isoDate,
  episodeCount: z.number().int(),
  id: tmdbId,
  name: z.string(),
  overview: z.string(),
  posterPath: imagePath,
  seasonNumber: z.number().int(),
});

export const tvDetailSchema = z.object({
  backdropPath: imagePath,
  episodeRunTime: z.array(z.number().int()),
  firstAirDate: isoDate,
  genres: z.array(namedEntitySchema),
  homepage: z.string().nullable(),
  id: tmdbId,
  inProduction: z.boolean(),
  lastAirDate: isoDate,
  name: z.string(),
  networks: z.array(companySchema),
  numberOfEpisodes: z.number().int(),
  numberOfSeasons: z.number().int(),
  originalName: z.string(),
  overview: z.string(),
  popularity: z.number(),
  posterPath: imagePath,
  seasons: z.array(seasonSummarySchema),
  status: z.string(),
  tagline: z.string().nullable(),
  voteAverage: z.number(),
  voteCount: z.number().int(),
});
export type TmdbTvDetail = z.infer<typeof tvDetailSchema>;

const episodeSchema = z.object({
  airDate: isoDate,
  episodeNumber: z.number().int(),
  id: tmdbId,
  name: z.string(),
  overview: z.string(),
  runtime: z.number().int().nullable(),
  seasonNumber: z.number().int(),
  stillPath: imagePath,
  voteAverage: z.number(),
  voteCount: z.number().int(),
});

export const seasonDetailSchema = z.object({
  airDate: isoDate,
  episodes: z.array(episodeSchema),
  id: tmdbId,
  name: z.string(),
  overview: z.string(),
  posterPath: imagePath,
  seasonNumber: z.number().int(),
});
export type TmdbSeasonDetail = z.infer<typeof seasonDetailSchema>;

export const creditsSchema = z.object({
  cast: z.array(
    z.object({
      character: z.string(),
      id: tmdbId,
      name: z.string(),
      order: z.number().int(),
      profilePath: imagePath,
    }),
  ),
  crew: z.array(
    z.object({
      department: z.string(),
      id: tmdbId,
      job: z.string(),
      name: z.string(),
      profilePath: imagePath,
    }),
  ),
  id: tmdbId,
});
export type TmdbCredits = z.infer<typeof creditsSchema>;

const imageSchema = z.object({
  aspectRatio: z.number(),
  filePath: z.string(),
  height: z.number().int(),
  language: z.string().nullable(),
  voteAverage: z.number(),
  voteCount: z.number().int(),
  width: z.number().int(),
});

export const imagesSchema = z.object({
  backdrops: z.array(imageSchema),
  id: tmdbId,
  logos: z.array(imageSchema),
  posters: z.array(imageSchema),
});
export type TmdbImages = z.infer<typeof imagesSchema>;

const providerSchema = z.object({
  displayPriority: z.number().int(),
  logoPath: imagePath,
  providerId: z.number().int(),
  providerName: z.string(),
});

export const watchProvidersSchema = z.object({
  ads: z.array(providerSchema),
  buy: z.array(providerSchema),
  flatrate: z.array(providerSchema),
  free: z.array(providerSchema),
  id: tmdbId,
  link: z.string().nullable(),
  region: z.string(),
  rent: z.array(providerSchema),
});
export type TmdbWatchProviders = z.infer<typeof watchProvidersSchema>;
