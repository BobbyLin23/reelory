import { expect, test } from "bun:test";

import { localeFromAcceptLanguage, localeFromCookieHeader, requestLocale } from "./locale";

test("reads only a supported saved locale from the cookie header", () => {
  expect(localeFromCookieHeader("reelory-locale=zh-CN; theme=dark")).toBe("zh-CN");
  expect(localeFromCookieHeader("reelory-locale=en")).toBe("en");
  expect(localeFromCookieHeader("reelory-locale=fr")).toBeNull();
  expect(localeFromCookieHeader("theme=dark")).toBeNull();
  expect(localeFromCookieHeader(null)).toBeNull();
});

test("resolves the interface language from Accept-Language by weight", () => {
  expect(localeFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
  expect(localeFromAcceptLanguage("zh-Hant,zh;q=0.8,en;q=0.7")).toBe("zh-CN");
  expect(localeFromAcceptLanguage("fr-FR,zh-CN;q=0.5")).toBe("zh-CN");
  expect(localeFromAcceptLanguage("fr-FR,de;q=0.8")).toBe("en");
  expect(localeFromAcceptLanguage(null)).toBe("en");
});

test("a saved cookie wins over the browser header for server rendering", () => {
  const request = new Request("https://reelory.test/settings", {
    headers: { "accept-language": "zh-CN,zh;q=0.9", cookie: "reelory-locale=en" },
  });

  expect(requestLocale(request)).toBe("en");
});
