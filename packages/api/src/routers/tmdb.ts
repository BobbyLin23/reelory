import { z } from "zod";

import { publicProcedure } from "../index";
import {
  creditsSchema,
  imagesSchema,
  mediaPageSchema,
  movieDetailSchema,
  seasonDetailSchema,
  tvDetailSchema,
  watchProvidersSchema,
} from "../tmdb/schemas";

const idInput = z.object({ id: z.number().int().positive() });

const pageSchema = z.number().int().min(1).max(500).default(1);

const regionSchema = z
  .string()
  .regex(/^[A-Z]{2}$/u, "Use a two-letter ISO 3166-1 region code")
  .default("US");

export const tmdbRouter = {
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

    watchProviders: publicProcedure
      .input(idInput.extend({ region: regionSchema }))
      .output(watchProvidersSchema)
      .handler(({ input, context }) => context.tmdb.movie.watchProviders(input)),
  },

  search: publicProcedure
    .input(
      z.object({
        page: pageSchema,
        query: z.string().trim().min(1).max(200),
      }),
    )
    .output(mediaPageSchema)
    .handler(({ input, context }) => context.tmdb.search(input)),

  trending: publicProcedure
    .input(
      z.object({
        mediaType: z.enum(["all", "movie", "tv"]).default("all"),
        page: pageSchema,
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

    season: publicProcedure
      .input(idInput.extend({ seasonNumber: z.number().int().min(0).max(100) }))
      .output(seasonDetailSchema)
      .handler(({ input, context }) => context.tmdb.tv.season(input)),

    watchProviders: publicProcedure
      .input(idInput.extend({ region: regionSchema }))
      .output(watchProvidersSchema)
      .handler(({ input, context }) => context.tmdb.tv.watchProviders(input)),
  },
};
