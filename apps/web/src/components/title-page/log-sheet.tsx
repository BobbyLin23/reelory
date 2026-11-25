import type { TmdbSeasonDetail, TmdbTvDetail } from "@reelory/api/tmdb/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState, useSyncExternalStore } from "react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Input } from "@/components/arc/input/input";
import { useToday } from "@/components/arc/lib/use-today";
import { Rating } from "@/components/arc/rating/rating";
import { Select } from "@/components/arc/select/select";
import { Textarea } from "@/components/arc/textarea/textarea";
import { useI18n } from "@/i18n/i18n";
import type { MessageKey, MessageParams } from "@/i18n/messages";
import type { ViewingMethod } from "@/utils/media";
import {
  VIEWING_METHODS,
  fromIsoDate,
  ratingToStars,
  starsToRating,
  toIsoDate,
  viewingMethodLabel,
} from "@/utils/media";
import { orpc } from "@/utils/orpc";

import styles from "./title-page.module.css";

interface WatchLog {
  episode: number | null;
  id: string;
  rating: number | null;
  review: string | null;
  season: number | null;
  tags: string[];
  viewingMethod: ViewingMethod | null;
  watchedOn: string | null;
}

interface LogSheetProps {
  entry: WatchLog | null;
  formKey: string;
  mediaType: "movie" | "tv";
  open: boolean;
  seasons: TmdbTvDetail["seasons"];
  title: string;
  tmdbId: number;
  onOpenChange: (open: boolean) => void;
  onSaved: (watch: { season: number | null }) => Promise<unknown>;
}

const none = "none";

const compactQuery = "(max-width: 639px)";
const subscribeCompact = (change: () => void) => {
  const query = window.matchMedia(compactQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};

/** Comma, fullwidth comma, and ideographic comma all separate tags. */
const parseTags = (value: string): string[] =>
  [
    ...new Set(
      value
        .split(/[,，、]/u)
        .map((tag) => tag.trim().slice(0, 50))
        .filter(Boolean),
    ),
  ].slice(0, 20);

const episodeOptions = (
  season: TmdbSeasonDetail | undefined,
  t: (key: MessageKey, params?: MessageParams) => string,
) => {
  const choose = { label: t("log.chooseEpisode"), value: none };
  if (season === undefined) {
    return [choose];
  }
  return [
    choose,
    ...season.episodes.map((episode) => ({
      label: `${episode.episodeNumber}. ${episode.name}`,
      value: String(episode.episodeNumber),
    })),
  ];
};

const LogForm = ({
  entry,
  mediaType,
  onOpenChange,
  onSaved,
  seasons,
  tmdbId,
}: Omit<LogSheetProps, "formKey" | "open" | "title">) => {
  const { locale, t } = useI18n();
  const today = useToday();
  const errorId = useId();
  const queryClient = useQueryClient();
  const isTv = mediaType === "tv";
  const [stars, setStars] = useState(() => ratingToStars(entry?.rating ?? null));
  const [review, setReview] = useState(() => entry?.review ?? "");
  const [tags, setTags] = useState(() => entry?.tags.join(", ") ?? "");
  const [viewingMethod, setViewingMethod] = useState(() => entry?.viewingMethod ?? none);
  const [season, setSeason] = useState(() =>
    entry?.season === null || entry?.season === undefined ? none : String(entry.season),
  );
  const [episode, setEpisode] = useState(() =>
    entry?.episode === null || entry?.episode === undefined ? none : String(entry.episode),
  );
  const [watchedOn, setWatchedOn] = useState<string | null | undefined>(() =>
    entry === null ? undefined : entry.watchedOn,
  );
  const [error, setError] = useState<string | null>(null);
  const todayDate = today === undefined ? null : toIsoDate(today);
  const resolvedDate = watchedOn === undefined ? todayDate : watchedOn;
  const seasonNumber = season === none ? null : Number(season);
  const seasonQuery = useQuery(
    orpc.tmdb.tv.season.queryOptions({
      enabled: isTv && seasonNumber !== null,
      input: { id: tmdbId, seasonNumber: seasonNumber ?? 0 },
    }),
  );
  const logWatch = useMutation(orpc.watch.log.mutationOptions());
  const updateWatch = useMutation(orpc.watch.update.mutationOptions());
  const pending = logWatch.isPending || updateWatch.isPending;
  const episodeChosen = season === none ? episode === none : episode !== none;
  const canSave = episodeChosen && !pending;
  const methodOptions = [
    { label: t("log.viewingMethodNone"), value: none },
    ...VIEWING_METHODS.map((method) => ({
      label: viewingMethodLabel(method, locale),
      value: method,
    })),
  ];

  const save = async () => {
    if (!canSave) {
      return;
    }
    setError(null);
    const fields = {
      episode: episode === none ? null : Number(episode),
      rating: starsToRating(stars),
      review: review.trim() === "" ? null : review.trim(),
      season: season === none ? null : Number(season),
      tags: parseTags(tags),
      viewingMethod: viewingMethod === none ? null : (viewingMethod as ViewingMethod),
      watchedOn: resolvedDate,
    };
    try {
      const saved = await (entry === null
        ? logWatch.mutateAsync({ mediaType, tmdbId, ...fields })
        : updateWatch.mutateAsync({ id: entry.id, ...fields }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.library.list.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.library.overview.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.watch.list.key() }),
      ]);
      await onSaved(saved);
      onOpenChange(false);
    } catch {
      setError(t("log.saveError"));
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
      <DatePicker
        description={t("log.dateDescription")}
        label={t("log.dateLabel")}
        labels={{
          calendar: t("arc.date.calendar"),
          chooseDay: t("arc.date.chooseDay"),
          clear: t("common.clear"),
          nextMonth: t("arc.calendar.nextMonth"),
          previousMonth: t("arc.calendar.previousMonth"),
          selected: t("arc.date.selected"),
          today: t("arc.calendar.today"),
          todayFull: t("arc.calendar.todayFull"),
        }}
        locale={locale}
        placeholder={t("log.datePlaceholder")}
        showToday
        value={resolvedDate === null ? undefined : fromIsoDate(resolvedDate)}
        onChange={(date) => setWatchedOn(date === undefined ? null : toIsoDate(date))}
      />
      <Rating
        allowClear
        allowHalf
        clearedLabel={t("arc.rating.cleared")}
        emptyLabel={t("log.noRating")}
        formatSpokenValue={(value, max) => t("arc.rating.spoken", { max, value })}
        formatValue={(value, max) => t("arc.rating.value", { max, value })}
        label={t("log.ratingLabel")}
        max={5}
        value={stars}
        onChange={setStars}
      />
      <Select
        label={t("log.viewingMethodLabel")}
        options={methodOptions}
        value={viewingMethod}
        onValueChange={setViewingMethod}
      />
      <Textarea
        description={t("log.reviewDescription")}
        label={t("log.reviewLabel")}
        rows={4}
        value={review}
        onChange={(event) => setReview(event.target.value)}
      />
      <Input
        description={t("log.tagsDescription")}
        label={t("log.tagsLabel")}
        placeholder={t("log.tagsPlaceholder")}
        value={tags}
        onChange={(event) => setTags(event.target.value)}
      />
      {isTv ? (
        <div className={styles.pair}>
          <Select
            label={t("log.seasonLabel")}
            options={[
              { label: t("log.wholeSeries"), value: none },
              ...seasons.map((item) => ({
                label: item.name,
                value: String(item.seasonNumber),
              })),
            ]}
            value={season}
            onValueChange={(value) => {
              setSeason(value);
              setEpisode(none);
            }}
          />
          <Select
            disabled={season === none}
            label={t("log.episodeLabel")}
            options={episodeOptions(seasonQuery.data, t)}
            value={episode}
            onValueChange={setEpisode}
          />
        </div>
      ) : null}
      {error === null ? null : (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
      <div className={styles.formActions}>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          {t("common.cancel")}
        </Button>
        <Button disabled={!canSave} loading={pending} type="submit">
          {entry === null ? t("log.save") : t("common.saveChanges")}
        </Button>
      </div>
    </form>
  );
};

export const LogSheet = ({
  entry,
  formKey,
  mediaType,
  onOpenChange,
  onSaved,
  open,
  seasons,
  title,
  tmdbId,
}: LogSheetProps) => {
  const { t } = useI18n();
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(compactQuery).matches,
    () => false,
  );
  const form = (
    <LogForm
      key={formKey}
      entry={entry}
      mediaType={mediaType}
      seasons={seasons}
      tmdbId={tmdbId}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
    />
  );

  if (compact) {
    return (
      <BottomSheet
        closeLabel={t("arc.dialog.close")}
        description={t("log.description", { title })}
        detents={[0.94]}
        open={open}
        title={entry === null ? t("log.titleNew") : t("log.titleEdit")}
        onOpenChange={onOpenChange}
      >
        {form}
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("arc.dialog.close")}
        description={t("log.description", { title })}
        title={entry === null ? t("log.titleNew") : t("log.titleEdit")}
      >
        {open ? form : null}
      </DialogContent>
    </Dialog>
  );
};
