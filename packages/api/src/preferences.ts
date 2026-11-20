import type { Database } from "@reelory/db";
import { userPreferences } from "@reelory/db/schema";
import { eq } from "drizzle-orm";

import { localeFromAcceptLanguage } from "./tmdb/locale";
import type { TmdbLocale } from "./tmdb/locale";

/**
 * The locale every TMDB call in a request uses: a preference the user saved in
 * Settings when present, otherwise the locale the request asks for (D6).
 */
export const resolveUserLocale = async ({
  acceptLanguage,
  db,
  userId,
}: {
  acceptLanguage: string | null;
  db: Database;
  userId: string | null | undefined;
}): Promise<TmdbLocale> => {
  const requested = localeFromAcceptLanguage(acceptLanguage);

  if (!userId) {
    return requested;
  }

  const saved = await db
    .select({ language: userPreferences.language, region: userPreferences.region })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .get();

  return {
    language: saved?.language ?? requested.language,
    region: saved?.region ?? requested.region,
  };
};
