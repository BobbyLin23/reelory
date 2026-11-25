import { localeFromAcceptLanguage } from "@reelory/api/tmdb/locale";

import { PageIntro } from "@/components/page-intro";
import { InterfaceLanguage } from "@/components/settings/interface-language";
import { LocalePreferences } from "@/components/settings/locale-preferences";
import { useI18n } from "@/i18n/i18n";
import { pageTitle } from "@/i18n/meta";

import type { Route } from "./+types/_app.settings";

export const meta: Route.MetaFunction = ({ matches }: Route.MetaArgs) => [
  { title: pageTitle(matches, "nav.settings") },
];

export const loader = ({ request }: Route.LoaderArgs) => ({
  locale: localeFromAcceptLanguage(request.headers.get("accept-language")),
});

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { t } = useI18n();

  return (
    <>
      <PageIntro description={t("settings.description")} title={t("nav.settings")} />
      <InterfaceLanguage />
      <LocalePreferences defaultLocale={loaderData.locale} />
    </>
  );
}
