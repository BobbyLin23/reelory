import { enUS, zhCN } from "date-fns/locale";

import type { Locale } from "react-day-picker";

const locales: Record<string, Locale> = { "zh-CN": zhCN };

/** The app's interface languages as the locales react-day-picker formats months and weekdays with. */
export const calendarLocale = (locale: string): Locale => locales[locale] ?? enUS;
