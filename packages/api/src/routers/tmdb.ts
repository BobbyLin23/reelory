import { z } from "zod";

import { publicProcedure } from "../index";
import {
  creditsSchema,
  genresSchema,
  imagesSchema,
  mediaPageSchema,
  movieDetailSchema,
  seasonDetailSchema,
  tmdbLocaleInput,
  tvDetailSchema,
  watchProvidersSchema,
} from "../tmdb/schemas";

const idInput = tmdbLocaleInput.extend({ id: z.number().int().positive() });
const pageInput = tmdbLocaleInput.extend({ page: z.number().int().min(1).max(500).default(1) });

export const tmdbRouter = {
  genres: {
    movie: publicProcedure
      .input(tmdbLocaleInput.default({}))
      .output(genresSchema)
      .handler(({ input, context }) => context.tmdb.genres.movie(input)),

    tv: publicProcedure
      .input(tmdbLocaleInput.default({}))
      .output(genresSchema)
      .handler(({ input, context }) => context.tmdb.genres.tv(input)),
  },

  movie: {
    credits: publicProcedure
      .input(idInput)
      .output(creditsSchema)
      .handler(({ input, context }) => context.tmdb.movie.credits(input)),

    detail: publicProcedure
      .input(idInput)
      .output(movieDetailSchema)
      .handler(({ input, context }) => context.tmdb.movie.detail(input)),

    images: publicProcedure
      .input(idInput)
      .output(imagesSchema)
      .handler(({ input, context }) => context.tmdb.movie.images(input)),

    nowPlaying: publicProcedure
      .input(pageInput.prefault({}))
      .output(mediaPageSchema)
      .handler(({ input, context }) => context.tmdb.movie.nowPlaying(input)),

    topRated: publicProcedure
      .input(pageInput.prefault({}))
      .output(mediaPageSchema)
      .handler(({ input, context }) => context.tmdb.movie.topRated(input)),

    upcoming: publicProcedure
      .input(pageInput.prefault({}))
      .output(mediaPageSchema)
      .handler(({ input, context }) => context.tmdb.movie.upcoming(input)),

    watchProviders: publicProcedure
      .input(idInput)
      .output(watchProvidersSchema)
      .handler(({ input, context }) => context.tmdb.movie.watchProviders(input)),
  },

  search: publicProcedure
    .input(pageInput.extend({ query: z.string().trim().min(1).max(200) }))
    .output(mediaPageSchema)
    .handler(({ input, context }) => context.tmdb.search(input)),

  trending: publicProcedure
    .input(
      pageInput.extend({
        mediaType: z.enum(["all", "movie", "tv"]).default("all"),
        window: z.enum(["day", "week"]).default("week"),
      }),
    )
    .output(mediaPageSchema)
    .handler(({ input, context }) => context.tmdb.trending(input)),

  tv: {
    credits: publicProcedure
      .input(idInput)
      .output(creditsSchema)
      .handler(({ input, context }) => context.tmdb.tv.credits(input)),

    detail: publicProcedure
      .input(idInput)
      .output(tvDetailSchema)
      .handler(({ input, context }) => context.tmdb.tv.detail(input)),

    images: publicProcedure
      .input(idInput)
      .output(imagesSchema)
      .handler(({ input, context }) => context.tmdb.tv.images(input)),

    onTheAir: publicProcedure
      .input(pageInput.prefault({}))
      .output(mediaPageSchema)
      .handler(({ input, context }) => context.tmdb.tv.onTheAir(input)),

    season: publicProcedure
      .input(idInput.extend({ seasonNumber: z.number().int().min(0).max(100) }))
      .output(seasonDetailSchema)
      .handler(({ input, context }) => context.tmdb.tv.season(input)),

    topRated: publicProcedure
      .input(pageInput.prefault({}))
      .output(mediaPageSchema)
      .handler(({ input, context }) => context.tmdb.tv.topRated(input)),

    watchProviders: publicProcedure
      .input(idInput)
      .output(watchProvidersSchema)
      .handler(({ input, context }) => context.tmdb.tv.watchProviders(input)),
  },
};
