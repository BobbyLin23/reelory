import type { Database } from "@reelory/db";
import { userPreferences } from "@reelory/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { tmdbLocaleInput } from "../tmdb/schemas";

const preferencesOutput = z.object({
  language: z.string().nullable(),
  region: z.string().nullable(),
});

const savedPreferences = (db: Database, userId: string) =>
  db
    .select({ language: userPreferences.language, region: userPreferences.region })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .get();

/** Metadata language and watch region, per user (D6). */
export const preferencesRouter = {
  /** What the user saved, or null before the first save so the request locale applies. */
  get: protectedProcedure
    .output(preferencesOutput.nullable())
    .handler(
      async ({ context }) => (await savedPreferences(context.db, context.auth.userId)) ?? null,
    ),

  /** Save one or both preferences; the other keeps its stored value. */
  set: protectedProcedure
    .input(
      z
        .object({
          language: tmdbLocaleInput.shape.language,
          region: tmdbLocaleInput.shape.region,
        })
        .refine((input) => input.language !== undefined || input.region !== undefined, {
          message: "Choose a language or a region",
        }),
    )
    .output(preferencesOutput)
    .handler(async ({ context, input }) => {
      const saved = await savedPreferences(context.db, context.auth.userId);
      const values = {
        language: input.language ?? saved?.language ?? null,
        region: input.region ?? saved?.region ?? null,
        updatedAt: new Date(),
      };

      return context.db
        .insert(userPreferences)
        .values({ ...values, userId: context.auth.userId })
        .onConflictDoUpdate({ set: values, target: userPreferences.userId })
        .returning({ language: userPreferences.language, region: userPreferences.region })
        .get();
    }),
};
