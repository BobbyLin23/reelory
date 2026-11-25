"use client";

import { useId } from "react";

import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import type { Segment } from "@/components/arc/segmented-control/segmented-control";
import { useI18n } from "@/i18n/i18n";
import { isLocale } from "@/i18n/locale";

import styles from "./interface-language.module.css";

const options: Segment[] = [
  { label: "English", value: "en" },
  { label: "简体中文", value: "zh-CN" },
];

/** The interface language is a display choice, so it applies at once and is saved for the next visit. */
export const InterfaceLanguage = () => {
  const id = useId();
  const { locale, setLocale, t } = useI18n();

  return (
    <section aria-labelledby={`${id}-heading`} className={styles.section}>
      <h2 className={styles.heading} id={`${id}-heading`}>
        {t("settings.interfaceTitle")}
      </h2>
      <p className={styles.description}>{t("settings.interfaceDescription")}</p>
      <SegmentedControl
        label={t("settings.interfaceControl")}
        options={options}
        value={locale}
        onValueChange={(value) => {
          if (isLocale(value)) {
            setLocale(value);
          }
        }}
      />
      <p className={styles.note}>{t("settings.interfaceNote")}</p>
    </section>
  );
};
