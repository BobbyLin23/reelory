import { ORPCError } from "@orpc/server";
import { watchEntries } from "@reelory/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { titleKey } from "./title-key";

const watchFields = z.object({
  episode: z.int().positive().nullish(),
  rating: z.int().min(1).max(10).nullish(),
  review: z.string().max(10_000).nullish(),
  season: z.int().nonnegative().nullish(),
  watchedOn: z.iso.date().nullish(),
});

const pairedEpisode = ({ season, episode }: z.infer<typeof watchFields>) =>
  (typeof season === "number") === (typeof episode === "number");

const ownedWatch = (id: string, userId: string) =>
  and(eq(watchEntries.id, id), eq(watchEntries.userId, userId));

export const watchRouter = {
  delete: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const deleted = await context.db
        .delete(watchEntries)
        .where(ownedWatch(input.id, context.auth.userId))
        .returning({ id: watchEntries.id })
        .get();
      if (!deleted) {
        throw new ORPCError("NOT_FOUND");
      }
      return deleted;
    }),

  list: protectedProcedure.input(titleKey).handler(({ context, input }) =>
    context.db
      .select()
      .from(watchEntries)
      .where(
        and(
          eq(watchEntries.userId, context.auth.userId),
          eq(watchEntries.tmdbId, input.tmdbId),
          eq(watchEntries.mediaType, input.mediaType),
        ),
      )
      .orderBy(desc(watchEntries.watchedOn), desc(watchEntries.createdAt), desc(watchEntries.id)),
  ),

  log: protectedProcedure
    .input(
      titleKey
        .extend(watchFields.shape)
        .refine(pairedEpisode, { message: "Provide both season and episode, or neither." })
        .refine(({ mediaType, season }) => mediaType === "tv" || typeof season !== "number", {
          message: "Only TV watches can have a season and episode.",
        }),
    )
    .handler(({ context, input }) =>
      context.db
        .insert(watchEntries)
        .values({ ...input, userId: context.auth.userId })
        .returning()
        .get(),
    ),

  update: protectedProcedure
    .input(
      watchFields
        .extend({ id: z.uuid() })
        .refine(
          ({ season, episode }) =>
            pairedEpisode({ episode, season }) &&
            (season === undefined) === (episode === undefined),
          {
            message: "Set or clear season and episode together.",
          },
        )
        .refine(
          ({ episode, rating, review, season, watchedOn }) =>
            [episode, rating, review, season, watchedOn].some((value) => value !== undefined),
          { message: "Provide at least one field to update." },
        ),
    )
    .handler(async ({ context, input: { id, ...changes } }) => {
      const where = ownedWatch(id, context.auth.userId);
      if (typeof changes.season === "number") {
        const row = await context.db
          .select({ mediaType: watchEntries.mediaType })
          .from(watchEntries)
          .where(where)
          .get();
        if (!row) {
          throw new ORPCError("NOT_FOUND");
        }
        if (row.mediaType !== "tv") {
          throw new ORPCError("BAD_REQUEST", {
            message: "Only TV watches can have a season and episode.",
          });
        }
      }
      const updated = await context.db
        .update(watchEntries)
        .set(changes)
        .where(where)
        .returning()
        .get();
      if (!updated) {
        throw new ORPCError("NOT_FOUND");
      }
      return updated;
    }),
};
