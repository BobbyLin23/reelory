import { Progress } from "@/components/arc/progress/progress";
import { useI18n } from "@/i18n/i18n";
import type { EpisodePosition, SeasonSummary } from "@/utils/media";
import { formatEpisode, seriesTotals } from "@/utils/media";

/**
 * Episode-level progress for a series: the furthest watched episode plus a bar
 * over the episode count TMDB reports for its regular seasons.
 */
export const SeriesProgress = ({
  progress,
  seasons,
  watchedEpisodes,
}: {
  progress: EpisodePosition | null;
  seasons: readonly SeasonSummary[];
  watchedEpisodes: number;
}) => {
  const { locale, t } = useI18n();
  const { episodeCount, seasonCount } = seriesTotals(seasons);
  if (episodeCount === 0) {
    return null;
  }
  const total = t(progress === null ? "progress.noneWatched" : "progress.watchedThrough", {
    episode: progress === null ? "" : formatEpisode(progress, locale),
    episodes: t("count.episodes", { count: episodeCount }),
    seasons: t("count.seasons", { count: seasonCount }),
  });

  return <Progress label={total} max={episodeCount} showValue value={watchedEpisodes} />;
};
