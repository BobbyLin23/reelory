import type { TmdbTvDetail } from "@reelory/api/tmdb/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { Button } from "@/components/arc/button/button";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { useToday } from "@/components/arc/lib/use-today";
import { Select } from "@/components/arc/select/select";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { SeriesProgress } from "@/components/series-progress/series-progress";
import type { EpisodePosition } from "@/utils/media";
import {
  episodesThrough,
  formatEpisode,
  fromIsoDate,
  furthestEpisode,
  nextEpisode,
  regularSeasons,
  seriesTotals,
  toIsoDate,
  watchedEpisodeCount,
} from "@/utils/media";
import { orpc } from "@/utils/orpc";

import styles from "./title-page.module.css";

import type { WatchLog } from "./title-sections";

interface MarkedThrough {
  created: number;
  through: EpisodePosition;
}

/** The first episode after `progress` inside a season, or null when the season is complete. */
const firstOpenEpisode = (
  season: TmdbTvDetail["seasons"][number],
  progress: EpisodePosition | null,
): number | null => {
  const start = season.seasonNumber === progress?.season ? progress.episode + 1 : 1;
  return start <= season.episodeCount ? start : null;
};

/** Marking through only moves forward, so closed and earlier seasons cannot be a target. */
const isOpenSeason = (season: TmdbTvDetail["seasons"][number], progress: EpisodePosition | null) =>
  (progress === null || season.seasonNumber >= progress.season) &&
  firstOpenEpisode(season, progress) !== null;

const MarkThroughForm = ({
  onMarked,
  onOpenChange,
  progress,
  seasons,
  tmdbId,
}: {
  onMarked: (marked: MarkedThrough) => void;
  onOpenChange: (open: boolean) => void;
  progress: EpisodePosition | null;
  seasons: TmdbTvDetail["seasons"];
  tmdbId: number;
}) => {
  const today = useToday();
  const errorId = useId();
  const queryClient = useQueryClient();
  const regular = regularSeasons(seasons);
  const firstOpen = regular.find((season) => isOpenSeason(season, progress));
  const [seasonNumber, setSeasonNumber] = useState(() =>
    String(firstOpen?.seasonNumber ?? regular.at(0)?.seasonNumber ?? ""),
  );
  const [episode, setEpisode] = useState(() =>
    String((firstOpen === undefined ? null : firstOpenEpisode(firstOpen, progress)) ?? 1),
  );
  const [watchedOn, setWatchedOn] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const markThrough = useMutation(orpc.watch.markThrough.mutationOptions());
  const todayDate = today === undefined ? null : toIsoDate(today);
  const resolvedDate = watchedOn === undefined ? todayDate : watchedOn;

  const selected = regular.find((season) => String(season.seasonNumber) === seasonNumber);
  const target =
    selected === undefined ? null : { episode: Number(episode), season: selected.seasonNumber };
  const inProgressSeason = selected !== undefined && selected.seasonNumber === progress?.season;
  const episodeOptions = Array.from({ length: selected?.episodeCount ?? 0 }, (_unused, index) => {
    const value = index + 1;
    return {
      disabled: inProgressSeason && value <= (progress?.episode ?? 0),
      label: `Episode ${value}`,
      value: String(value),
    };
  });

  const save = async () => {
    if (target === null) {
      return;
    }
    const episodes = episodesThrough(seasons, progress, target);
    if (episodes.length === 0) {
      setError(
        progress === null
          ? "Pick an episode in a season TMDB knows about."
          : `Pick an episode after ${formatEpisode(progress)}. Log an earlier one with Log a watch.`,
      );
      return;
    }
    setError(null);
    try {
      const result = await markThrough.mutateAsync({
        episodes,
        mediaType: "tv",
        tmdbId,
        watchedOn: resolvedDate,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.library.overview.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.watch.list.key() }),
      ]);
      onMarked({ created: result.created, through: target });
      onOpenChange(false);
    } catch {
      setError("We could not save those episodes. Check your connection and try again.");
    }
  };

  return (
    <form
      aria-describedby={error === null ? undefined : errorId}
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Select
        label="Season"
        options={regular.map((season) => ({
          disabled: !isOpenSeason(season, progress),
          label: season.name,
          value: String(season.seasonNumber),
        }))}
        value={seasonNumber}
        onValueChange={(value) => {
          const season = regular.find((item) => String(item.seasonNumber) === value);
          setSeasonNumber(value);
          setEpisode(
            String((season === undefined ? null : firstOpenEpisode(season, progress)) ?? 1),
          );
        }}
      />
      <Select
        label="Through episode"
        options={episodeOptions}
        value={episode}
        onValueChange={setEpisode}
      />
      <DatePicker
        description="Every episode you fill gets this date."
        label="Watch date"
        placeholder="Unknown"
        showToday
        value={resolvedDate === null ? undefined : fromIsoDate(resolvedDate)}
        onChange={(date) => setWatchedOn(date === undefined ? null : toIsoDate(date))}
      />
      {error === null ? null : (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
      <div className={styles.formActions}>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button disabled={target === null} loading={markThrough.isPending} type="submit">
          {target === null ? "Mark through" : `Mark through ${formatEpisode(target)}`}
        </Button>
      </div>
    </form>
  );
};

export const SeriesProgressSection = ({
  isPending,
  seasons,
  tmdbId,
  watches,
}: {
  isPending: boolean;
  seasons: TmdbTvDetail["seasons"];
  tmdbId: number;
  watches: WatchLog[];
}) => {
  const queryClient = useQueryClient();
  const [throughOpen, setThroughOpen] = useState(false);
  const [marked, setMarked] = useState<MarkedThrough | null>(null);
  const logNext = useMutation(orpc.watch.log.mutationOptions());
  const totals = seriesTotals(seasons);
  const progress = furthestEpisode(watches);
  const watched = watchedEpisodeCount(watches);
  const next = nextEpisode(seasons, progress);

  if (totals.seasonCount === 0) {
    return null;
  }

  const markNext = async () => {
    if (next === null) {
      return;
    }
    setMarked(null);
    try {
      await logNext.mutateAsync({
        episode: next.episode,
        mediaType: "tv",
        season: next.season,
        tmdbId,
        watchedOn: toIsoDate(new Date()),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.library.overview.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.watch.list.key() }),
      ]);
    } catch {
      // The alert below the actions reports the failure.
    }
  };

  return (
    <section aria-labelledby="series-progress-heading" className={styles.section}>
      <h2 className={styles.heading} id="series-progress-heading">
        Series progress
      </h2>
      <Skeleton label="Loading series progress" lines={2} loading={isPending}>
        <div className={styles.progressBody}>
          <SeriesProgress progress={progress} seasons={seasons} watchedEpisodes={watched} />
          <p className={styles.progressCount}>
            {watched} of {totals.episodeCount} episodes watched
          </p>
        </div>
      </Skeleton>
      <div className={styles.actions}>
        <Button
          disabled={next === null || isPending}
          loading={logNext.isPending}
          type="button"
          variant="secondary"
          onClick={() => void markNext()}
        >
          {next === null ? "Nothing left to mark" : `Mark ${formatEpisode(next)} watched`}
        </Button>
        <Button
          disabled={next === null || isPending}
          type="button"
          variant="secondary"
          onClick={() => setThroughOpen(true)}
        >
          Mark through an episode
        </Button>
      </div>
      {next === null ? (
        <p className={styles.note}>
          Every episode TMDB lists is watched. The series stays in Watching until you move it.
        </p>
      ) : null}
      {logNext.isError ? (
        <p className={styles.error} role="alert">
          We could not save that episode. Check your connection and try again.
        </p>
      ) : null}
      {marked === null ? null : (
        <p className={styles.note} role="status">
          Marked {marked.created} {marked.created === 1 ? "episode" : "episodes"} through{" "}
          {formatEpisode(marked.through)}.
        </p>
      )}
      <Dialog open={throughOpen} onOpenChange={setThroughOpen}>
        <DialogContent
          description={
            progress === null
              ? "Fills every episode through the one you pick. Episodes you already watched are skipped."
              : `Fills every episode after ${formatEpisode(progress)} through the one you pick. Episodes you already watched are skipped.`
          }
          title="Mark through an episode"
        >
          {throughOpen ? (
            <MarkThroughForm
              progress={progress}
              seasons={seasons}
              tmdbId={tmdbId}
              onMarked={setMarked}
              onOpenChange={setThroughOpen}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
};
