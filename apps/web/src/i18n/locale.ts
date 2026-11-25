/** The interface languages the site offers. Chinese means Simplified Chinese. */
export const LOCALES = ["en", "zh-CN"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Persisted separately from the TMDB metadata language, which lives in user preferences. */
export const LOCALE_COOKIE = "reelory-locale";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && LOCALES.includes(value as Locale);

export const htmlLang = (locale: Locale): string => locale;

const cookieValue = (header: string, name: string): string | null => {
  for (const entry of header.split(";")) {
    const separator = entry.indexOf("=");
    if (separator === -1) {
      continue;
    }

    if (entry.slice(0, separator).trim() === name) {
      const raw = entry.slice(separator + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }

  return null;
};

/** Reads the saved interface language so the server can render the right strings on the first paint. */
export const localeFromCookieHeader = (header: string | null): Locale | null => {
  const saved = header === null ? null : cookieValue(header, LOCALE_COOKIE);
  return isLocale(saved) ? saved : null;
};

/**
 * The interface offers English and Simplified Chinese only, so the first
 * acceptable language in the header decides; any Chinese tag means Simplified
 * Chinese. Other languages fall back to English.
 */
export const localeFromAcceptLanguage = (header: string | null): Locale => {
  const tags = (header ?? "")
    .split(",")
    .map((entry, index) => {
      const [tag = "", ...parameters] = entry.trim().toLowerCase().split(";");
      const quality = parameters
        .map((parameter) => parameter.trim())
        .find((p) => p.startsWith("q="));
      const weight = quality === undefined ? 1 : Number(quality.slice(2));

      return { index, tag, weight: Number.isFinite(weight) ? weight : 1 };
    })
    .filter(({ tag, weight }) => tag.length > 0 && weight > 0)
    .toSorted((left, right) => right.weight - left.weight || left.index - right.index);

  for (const { tag } of tags) {
    const language = tag.split("-")[0];
    if (language === "zh") {
      return "zh-CN";
    }
    if (language === "en") {
      return "en";
    }
  }

  return DEFAULT_LOCALE;
};

export const requestLocale = (request: Request): Locale =>
  localeFromCookieHeader(request.headers.get("cookie")) ??
  localeFromAcceptLanguage(request.headers.get("accept-language"));

/** The cookie is the source of truth across reloads and server renders. */
export const writeLocaleCookie = (locale: Locale) => {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
};
