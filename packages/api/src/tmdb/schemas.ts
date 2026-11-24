import { z } from "zod";

const tmdbId = z.number().int().positive();
const imagePath = z.string().nullable();
const isoDate = z.string().nullable();

// ISO 639-1 languages and ISO 3166-1 alpha-2 regions. Validate membership as
// well as shape so two-letter placeholders such as xx and ZZ don't pass.
export const SUPPORTED_LANGUAGES = new Set(
  `
  aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da
  de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz
  ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln
  lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi
  pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti
  tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu
`
    .trim()
    .split(/\s+/u),
);
export const SUPPORTED_REGIONS = new Set(
  `
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS
  BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE
  EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM
  HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC
  LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA
  NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW
  SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO
  TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`
    .trim()
    .split(/\s+/u),
);

export const tmdbLocaleInput = z.object({
  language: z
    .string()
    .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/u, "Use a language code like en or zh-CN")
    .refine((value) => {
      const [language, region] = value.split("-");
      return (
        SUPPORTED_LANGUAGES.has(language ?? "") &&
        (region === undefined || SUPPORTED_REGIONS.has(region))
      );
    }, "Use an ISO 639-1 language with an optional ISO 3166-1 region")
    .optional(),
  region: z
    .string()
    .refine((value) => SUPPORTED_REGIONS.has(value), "Use a two-letter ISO 3166-1 region code")
    .optional(),
});
export type TmdbLocaleInput = z.infer<typeof tmdbLocaleInput>;

export const namedEntitySchema = z.object({
  id: tmdbId,
  name: z.string(),
});
export type NamedEntity = z.infer<typeof namedEntitySchema>;
export const genresSchema = z.array(namedEntitySchema);

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

const titleSummarySchema = z.discriminatedUnion("mediaType", [movieSummarySchema, tvSummarySchema]);
export type TmdbTitleSummary = z.infer<typeof titleSummarySchema>;

const personSummarySchema = z.object({
  id: tmdbId,
  knownFor: z.array(titleSummarySchema).optional(),
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
  createdBy: z.array(namedEntitySchema),
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
