import type { TmdbTvDetail } from "@reelory/api/tmdb/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { useToday } from "@/components/arc/lib/use-today";
import { Select } from "@/components/arc/select/select";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { SeriesProgress } from "@/components/series-progress/series-progress";
import { useI18n } from "@/i18n/i18n";
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

import type { WatchLog } from "./title-sections";
import { WatchDateField } from "./watch-date-field";

import styles from "./title-page.module.css";

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
  onTrack,
  progress,
  seasons,
  tmdbId,
}: {
  onMarked: (marked: MarkedThrough) => void;
  onOpenChange: (open: boolean) => void;
  onTrack: () => Promise<unknown>;
  progress: EpisodePosition | null;
  seasons: TmdbTvDetail["seasons"];
  tmdbId: number;
}) => {
  const { locale, t } = useI18n();
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
      label: t("series.episodeLabel", { number: value }),
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
          ? t("series.pickSeason")
          : t("series.pickAfter", { episode: formatEpisode(progress, locale) }),
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
      await onTrack();
      onMarked({ created: result.created, through: target });
      onOpenChange(false);
    } catch {
      setError(t("series.saveEpisodesError"));
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
        label={t("log.seasonLabel")}
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
        label={t("series.throughLabel")}
        options={episodeOptions}
        value={episode}
        onValueChange={setEpisode}
      />
      <WatchDateField
        description={t("series.dateDescription")}
        label={t("log.dateLabel")}
        placeholder={t("log.datePlaceholder")}
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
          {t("common.cancel")}
        </Button>
        <Button disabled={target === null} loading={markThrough.isPending} type="submit">
          {target === null
            ? t("series.markThroughButton")
            : t("series.markThroughTarget", { episode: formatEpisode(target, locale) })}
        </Button>
      </div>
    </form>
  );
};

export const SeriesProgressSection = ({
  isPending,
  onTrack,
  seasons,
  tmdbId,
  watches,
}: {
  isPending: boolean;
  onTrack: () => Promise<unknown>;
  seasons: TmdbTvDetail["seasons"];
  tmdbId: number;
  watches: WatchLog[];
}) => {
  const { locale, t } = useI18n();
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
      await onTrack();
    } catch {
      // The alert below the actions reports the failure.
    }
  };

  return (
    <section aria-labelledby="series-progress-heading" className={styles.section}>
      <h2 className={styles.heading} id="series-progress-heading">
        {t("series.progress")}
      </h2>
      <Skeleton label={t("series.loading")} lines={2} loading={isPending}>
        <div className={styles.progressBody}>
          <SeriesProgress progress={progress} seasons={seasons} watchedEpisodes={watched} />
          <p className={styles.progressCount}>
            {t("series.count", { total: totals.episodeCount, watched })}
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
          {next === null
            ? t("series.nothingLeft")
            : t("series.markWatched", { episode: formatEpisode(next, locale) })}
        </Button>
        <Button
          disabled={next === null || isPending}
          type="button"
          variant="secondary"
          onClick={() => setThroughOpen(true)}
        >
          {t("series.markThrough")}
        </Button>
      </div>
      {next === null ? <p className={styles.note}>{t("series.allWatched")}</p> : null}
      {logNext.isError ? (
        <p className={styles.error} role="alert">
          {t("series.saveError")}
        </p>
      ) : null}
      {marked === null ? null : (
        <p className={styles.note} role="status">
          {t("count.marked", {
            count: marked.created,
            episode: formatEpisode(marked.through, locale),
          })}
        </p>
      )}
      <Dialog open={throughOpen} onOpenChange={setThroughOpen}>
        <DialogContent
          closeLabel={t("arc.dialog.close")}
          description={
            progress === null
              ? t("series.markThroughDescriptionNone")
              : t("series.markThroughDescriptionProgress", {
                  episode: formatEpisode(progress, locale),
                })
          }
          title={t("series.markThroughTitle")}
        >
          {throughOpen ? (
            <MarkThroughForm
              progress={progress}
              seasons={seasons}
              tmdbId={tmdbId}
              onMarked={setMarked}
              onOpenChange={setThroughOpen}
              onTrack={onTrack}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
};
