import { expect, test } from "bun:test";

import { DEFAULT_LOCALE, localeFromAcceptLanguage } from "./locale";

test("resolves the metadata language and watch region from the request locale", () => {
  expect(localeFromAcceptLanguage("zh-CN,zh;q=0.9,en;q=0.8")).toEqual({
    language: "zh-CN",
    region: "CN",
  });
  expect(localeFromAcceptLanguage("zh-Hans-CN")).toEqual({ language: "zh-CN", region: "CN" });
  expect(localeFromAcceptLanguage("zh-TW")).toEqual({ language: "zh-TW", region: "TW" });
  expect(localeFromAcceptLanguage("zh-Hant")).toEqual({ language: "zh-TW", region: "TW" });
  expect(localeFromAcceptLanguage("zh-HK")).toEqual({ language: "zh-HK", region: "HK" });
  expect(localeFromAcceptLanguage("zh")).toEqual({ language: "zh-CN", region: "CN" });
});

test("keeps another language's own region instead of assuming the US", () => {
  expect(localeFromAcceptLanguage("en-GB")).toEqual({ language: "en", region: "GB" });
  expect(localeFromAcceptLanguage("pt-BR")).toEqual({ language: "pt", region: "BR" });
  expect(localeFromAcceptLanguage("fr-CA")).toEqual({ language: "fr", region: "CA" });
  expect(localeFromAcceptLanguage("ja")).toEqual({ language: "ja", region: "JP" });
});

test("takes the first language TMDB can serve, by weight", () => {
  expect(localeFromAcceptLanguage("ja-JP,en;q=0.5")).toEqual({ language: "ja", region: "JP" });
  expect(localeFromAcceptLanguage("xx-YY,en;q=0.5")).toEqual({ language: "en", region: "US" });
  expect(localeFromAcceptLanguage("zh-CN;q=0,en;q=0.5")).toEqual({ language: "en", region: "US" });
  expect(localeFromAcceptLanguage("klingon,de;q=0.4")).toEqual({ language: "de", region: "DE" });
});

test("falls back to today's output when the header says nothing usable", () => {
  expect(localeFromAcceptLanguage(null)).toEqual(DEFAULT_LOCALE);
  expect(localeFromAcceptLanguage("")).toEqual(DEFAULT_LOCALE);
  expect(localeFromAcceptLanguage("*")).toEqual(DEFAULT_LOCALE);
});
