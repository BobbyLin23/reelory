import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { TitlePage } from "@/components/title-page/title-page";
import { isMediaType, parseTmdbId } from "@/utils/media";

import type { Route } from "./+types/_app.title.$mediaType.$id";

export const meta = ({ params }: Route.MetaArgs) => {
  const kind = params.mediaType === "tv" ? "Series" : "Film";
  return [{ title: `${kind} · reelory` }];
};

const TitleRoute = ({ params }: Route.ComponentProps) => {
  const tmdbId = parseTmdbId(params.id);
  if (!isMediaType(params.mediaType) || tmdbId === null) {
    return (
      <EmptyState
        description="Use a film or series address such as /title/movie/550."
        title="This title link is not valid"
      />
    );
  }

  return <TitlePage mediaType={params.mediaType} tmdbId={tmdbId} />;
};

export default TitleRoute;
