"use client";

import type { TmdbLocale } from "@reelory/api/tmdb/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Select } from "@/components/arc/select/select";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { orpc } from "@/utils/orpc";

import styles from "./locale-preferences.module.css";

interface Option {
  label: string;
  value: string;
}

/** TMDB serves Chinese per locale, so those three stay distinct; other languages use the base code. */
const languages: Option[] = [
  { label: "简体中文", value: "zh-CN" },
  { label: "繁體中文", value: "zh-TW" },
  { label: "繁體中文（香港）", value: "zh-HK" },
  { label: "English", value: "en" },
  { label: "日本語", value: "ja" },
  { label: "한국어", value: "ko" },
  { label: "Français", value: "fr" },
  { label: "Deutsch", value: "de" },
  { label: "Español", value: "es" },
  { label: "Português", value: "pt" },
  { label: "Italiano", value: "it" },
  { label: "Русский", value: "ru" },
  { label: "हिन्दी", value: "hi" },
  { label: "ไทย", value: "th" },
  { label: "Tiếng Việt", value: "vi" },
  { label: "Bahasa Indonesia", value: "id" },
  { label: "Türkçe", value: "tr" },
  { label: "العربية", value: "ar" },
  { label: "Nederlands", value: "nl" },
  { label: "Polski", value: "pl" },
  { label: "Svenska", value: "sv" },
  { label: "Українська", value: "uk" },
];

const regions = [
  "CN",
  "HK",
  "TW",
  "US",
  "GB",
  "JP",
  "KR",
  "SG",
  "CA",
  "AU",
  "NZ",
  "DE",
  "FR",
  "ES",
  "IT",
  "PT",
  "NL",
  "SE",
  "PL",
  "RU",
  "UA",
  "IN",
  "TH",
  "VN",
  "ID",
  "MY",
  "PH",
  "TR",
  "SA",
  "AE",
  "BR",
  "MX",
  "AR",
];

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** Keep a locale the request brought in selectable even when it is not a listed option. */
const withCurrent = (options: Option[], value: string, fallbackLabel: string): Option[] =>
  options.some((option) => option.value === value)
    ? options
    : [...options, { label: fallbackLabel, value }];

const regionOptions = regions.map((code) => ({ label: regionNames.of(code) ?? code, value: code }));

export function LocalePreferences({ defaultLocale }: { defaultLocale: TmdbLocale }) {
  const id = useId();
  const queryClient = useQueryClient();
  const preferences = useQuery(orpc.preferences.get.queryOptions());
  const save = useMutation(orpc.preferences.set.mutationOptions());
  const [changes, setChanges] = useState<Partial<TmdbLocale>>({});
  const [saved, setSaved] = useState(false);

  const current = {
    language: changes.language ?? preferences.data?.language ?? defaultLocale.language,
    region: changes.region ?? preferences.data?.region ?? defaultLocale.region,
  };
  const dirty = Object.keys(changes).length > 0;

  const change = (patch: Partial<TmdbLocale>) => {
    setSaved(false);
    save.reset();
    setChanges((previous) => ({ ...previous, ...patch }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await save.mutateAsync(changes).catch(() => null);

    if (!result) {
      return;
    }

    queryClient.setQueryData(orpc.preferences.get.queryKey(), result);
    // Title metadata and provider data already on screen refetch in the new locale.
    await queryClient.invalidateQueries({ queryKey: orpc.tmdb.key() });
    setChanges({});
    setSaved(true);
  };

  return (
    <section aria-labelledby={`${id}-heading`} className={styles.section}>
      <h2 className={styles.heading} id={`${id}-heading`}>
        Language and region
      </h2>

      <Skeleton label="Loading language and region" lines={2} loading={preferences.isPending}>
        {preferences.isError ? (
          <Alert title="Your preferences did not load" tone="danger">
            <Button onClick={() => preferences.refetch()} size="sm" variant="secondary">
              Try again
            </Button>
          </Alert>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <Select
              description="Titles, overviews, and genres appear in this language."
              label="Metadata language"
              onValueChange={(language) => change({ language })}
              options={withCurrent(
                languages,
                current.language,
                languageNames.of(current.language.split("-")[0] ?? "") ?? current.language,
              )}
              value={current.language}
            />
            <Select
              description="Streaming providers are shown for this region."
              label="Watch region"
              onValueChange={(region) => change({ region })}
              options={withCurrent(
                regionOptions,
                current.region,
                regionNames.of(current.region) ?? current.region,
              )}
              value={current.region}
            />

            {save.isError ? (
              <Alert title="Your preferences were not saved" tone="danger">
                Check your connection and save again.
              </Alert>
            ) : null}

            <div className={styles.actions}>
              <Button disabled={!dirty} loading={save.isPending} type="submit">
                {saved && !dirty ? "Saved" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </Skeleton>
    </section>
  );
}
