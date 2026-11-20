import { Progress } from "@/components/arc/progress/progress";
import type { EpisodePosition, SeasonSummary } from "@/utils/media";
import { formatEpisode, seriesTotals } from "@/utils/media";

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

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
  const { episodeCount, seasonCount } = seriesTotals(seasons);
  if (episodeCount === 0) {
    return null;
  }
  const total = `of ${plural(seasonCount, "season")}, ${plural(episodeCount, "episode")}`;
  return (
    <Progress
      label={
        progress === null
          ? `No episodes watched (${total})`
          : `Watched through ${formatEpisode(progress)} (${total})`
      }
      max={episodeCount}
      showValue
      value={watchedEpisodes}
    />
  );
};
