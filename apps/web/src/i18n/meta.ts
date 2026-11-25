import type { Locale } from "./locale";
import { DEFAULT_LOCALE, isLocale } from "./locale";
import type { MessageKey } from "./messages";
import { translate } from "./messages";

interface MatchLike {
  id: string;
  loaderData?: unknown;
}

const localeFromMatches = (matches: readonly (MatchLike | undefined)[]): Locale => {
  const data = matches.find((match) => match?.id === "root")?.loaderData;

  if (data !== null && typeof data === "object" && "locale" in data && isLocale(data.locale)) {
    return data.locale;
  }

  return DEFAULT_LOCALE;
};

/** Route meta runs outside React, so the page title reads the locale from the root loader data. */
export const pageTitle = (matches: readonly (MatchLike | undefined)[], key: MessageKey): string =>
  `${translate(localeFromMatches(matches), key)} · reelory`;
