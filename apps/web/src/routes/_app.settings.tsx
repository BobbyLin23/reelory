import { localeFromAcceptLanguage } from "@reelory/api/tmdb/locale";

import { PageIntro } from "@/components/page-intro";
import { LocalePreferences } from "@/components/settings/locale-preferences";

import type { Route } from "./+types/_app.settings";

export const meta = () => [{ title: "Settings · reelory" }];

export const loader = ({ request }: Route.LoaderArgs) => ({
  locale: localeFromAcceptLanguage(request.headers.get("accept-language")),
});

export default function Settings({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageIntro
        description="Choose the language and region used for titles and streaming providers."
        title="Settings"
      />
      <LocalePreferences defaultLocale={loaderData.locale} />
    </>
  );
}
