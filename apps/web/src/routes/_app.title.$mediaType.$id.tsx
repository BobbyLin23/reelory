import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TitlePage } from "@/components/title-page/title-page";
import { useI18n } from "@/i18n/i18n";
import { pageTitle } from "@/i18n/meta";
import { isMediaType, parseTmdbId } from "@/utils/media";

import type { Route } from "./+types/_app.title.$mediaType.$id";

export const meta: Route.MetaFunction = ({ matches, params }: Route.MetaArgs) => [
  {
    title: pageTitle(matches, params.mediaType === "tv" ? "common.series" : "common.film"),
  },
];

const TitleRoute = ({ params }: Route.ComponentProps) => {
  const { t } = useI18n();
  const tmdbId = parseTmdbId(params.id);

  if (!isMediaType(params.mediaType) || tmdbId === null) {
    return (
      <EmptyState
        description={t("errors.invalidTitleDescription")}
        title={t("errors.invalidTitleTitle")}
      />
    );
  }

  return <TitlePage mediaType={params.mediaType} tmdbId={tmdbId} />;
};

export default TitleRoute;
