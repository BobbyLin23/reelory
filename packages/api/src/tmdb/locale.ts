import { SUPPORTED_LANGUAGES, SUPPORTED_REGIONS } from "./schemas";

export interface TmdbLocale {
  language: string;
  region: string;
}

/** What a request without a usable locale header gets, matching CNS-1058's output. */
export const DEFAULT_LOCALE: TmdbLocale = { language: "en-US", region: "US" };

/**
 * Watch region for a language tag that names no region, such as `en` or `zh-Hans`.
 * Chinese is resolved from its own tag instead because TMDB distinguishes all three.
 */
const REGION_FOR_LANGUAGE: Record<string, string> = {
  ar: "SA",
  bn: "BD",
  cs: "CZ",
  da: "DK",
  de: "DE",
  el: "GR",
  en: "US",
  es: "ES",
  fa: "IR",
  fi: "FI",
  fil: "PH",
  fr: "FR",
  he: "IL",
  hi: "IN",
  hu: "HU",
  id: "ID",
  it: "IT",
  ja: "JP",
  ko: "KR",
  ms: "MY",
  nb: "NO",
  nl: "NL",
  no: "NO",
  pl: "PL",
  pt: "PT",
  ro: "RO",
  ru: "RU",
  sv: "SE",
  sw: "KE",
  ta: "IN",
  th: "TH",
  tr: "TR",
  uk: "UA",
  ur: "PK",
  vi: "VN",
  zh: "CN",
};

const chineseLanguage = (region: string | undefined, script: string | undefined) => {
  if (region === "HK" || region === "MO") {
    return "zh-HK";
  }
  if (region === "TW" || script === "hant") {
    return "zh-TW";
  }
  return "zh-CN";
};

const parseTag = (tag: string) => {
  const [language = "", ...subtags] = tag.toLowerCase().split("-");
  let region: string | undefined;
  let script: string | undefined;

  for (const subtag of subtags) {
    if (subtag.length === 2) {
      region = subtag.toUpperCase();
    } else if (subtag.length === 4) {
      script = subtag;
    }
  }

  return { language, region, script };
};

/** Split `Accept-Language` into tags ordered by weight, keeping header order for ties. */
const preferredTags = (header: string) => {
  const entries = header.split(",").map((entry, index) => {
    const [tag = "", ...parameters] = entry.trim().split(";");
    const quality = parameters.map((parameter) => parameter.trim()).find((p) => p.startsWith("q="));
    const weight = quality ? Number(quality.slice(2)) : 1;

    return { index, tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 1 };
  });

  return entries
    .filter(({ tag, weight }) => weight > 0 && tag.length > 0 && tag !== "*")
    .sort((left, right) => right.weight - left.weight || left.index - right.index);
};

/**
 * Resolve the metadata language and watch region a request asks for (D6). The
 * first acceptable tag TMDB can serve wins, so a `zh-CN` browser gets `zh-CN`
 * and `CN` and an `en-GB` browser gets English metadata with `GB` providers.
 */
export const localeFromAcceptLanguage = (header: string | null): TmdbLocale => {
  for (const { tag } of preferredTags(header ?? "")) {
    const { language, region, script } = parseTag(tag);

    if (!SUPPORTED_LANGUAGES.has(language)) {
      continue;
    }

    const localizedLanguage = language === "zh" ? chineseLanguage(region, script) : language;
    const taggedRegion = region && SUPPORTED_REGIONS.has(region) ? region : undefined;
    const impliedRegion = localizedLanguage.split("-")[1];
    const fallbackRegion = REGION_FOR_LANGUAGE[language] ?? DEFAULT_LOCALE.region;

    return {
      language: localizedLanguage,
      region:
        taggedRegion ??
        (impliedRegion && SUPPORTED_REGIONS.has(impliedRegion) ? impliedRegion : fallbackRegion),
    };
  }

  return DEFAULT_LOCALE;
};
