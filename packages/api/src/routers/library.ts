import { LIBRARY_STATUSES, libraryEntries } from "@reelory/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { titleKey } from "./title-key";

const status = z.enum(LIBRARY_STATUSES);

const snapshot = z.object({
  genres: z.array(z.string().trim().min(1).max(100)).max(50),
  posterPath: z
    .string()
    .regex(/^\/[\w-]+\.[a-zA-Z0-9]+$/u)
    .max(255)
    .nullable(),
  title: z.string().trim().min(1).max(500),
  year: z.int().min(1).max(9999).nullable(),
});

export const libraryRouter = {
  list: protectedProcedure
    .input(
      z
        .object({ mediaType: titleKey.shape.mediaType.optional(), status: status.optional() })
        .default({}),
    )
    .handler(({ context, input }) =>
      context.db
        .select()
        .from(libraryEntries)
        .where(
          and(
            eq(libraryEntries.userId, context.auth.userId),
            input.status ? eq(libraryEntries.status, input.status) : undefined,
            input.mediaType ? eq(libraryEntries.mediaType, input.mediaType) : undefined,
          ),
        )
        .orderBy(
          desc(libraryEntries.updatedAt),
          desc(libraryEntries.createdAt),
          desc(libraryEntries.id),
        ),
    ),

  setStatus: protectedProcedure
    .input(titleKey.extend({ snapshot, status }))
    .handler(({ context, input }) => {
      const values = { ...input.snapshot, status: input.status, updatedAt: new Date() };
      return context.db
        .insert(libraryEntries)
        .values({
          ...values,
          mediaType: input.mediaType,
          tmdbId: input.tmdbId,
          userId: context.auth.userId,
        })
        .onConflictDoUpdate({
          set: values,
          target: [libraryEntries.userId, libraryEntries.tmdbId, libraryEntries.mediaType],
        })
        .returning()
        .get();
    }),
};
