"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRevalidator } from "react-router";

import type { Locale } from "./locale";
import { htmlLang, writeLocaleCookie } from "./locale";
import type { MessageKey, MessageParams } from "./messages";
import { translate } from "./messages";

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  children,
  locale: initialLocale,
}: {
  children: ReactNode;
  locale: Locale;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const revalidator = useRevalidator();

  // The root loader revalidates after a switch, and a reload brings the saved locale back in.
  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      writeLocaleCookie(next);
      document.documentElement.lang = htmlLang(next);
      // Re-run loaders so route titles pick up the new language; the cookie is already saved.
      void revalidator.revalidate();
    },
    [revalidator],
  );

  useEffect(() => {
    document.documentElement.lang = htmlLang(locale);
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = (): I18nValue => {
  const value = useContext(I18nContext);

  if (value === null) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return value;
};
