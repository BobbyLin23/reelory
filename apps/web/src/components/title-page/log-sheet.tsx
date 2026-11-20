import type { TmdbSeasonDetail, TmdbTvDetail } from "@reelory/api/tmdb/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { Button } from "@/components/arc/button/button";
import { DatePicker } from "@/components/arc/date-picker/date-picker";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { useToday } from "@/components/arc/lib/use-today";
import { Rating } from "@/components/arc/rating/rating";
import { Select } from "@/components/arc/select/select";
import { Textarea } from "@/components/arc/textarea/textarea";
import { fromIsoDate, ratingToStars, starsToRating, toIsoDate } from "@/utils/media";
import { orpc } from "@/utils/orpc";

import styles from "./title-page.module.css";

interface WatchLog {
  episode: number | null;
  id: string;
  rating: number | null;
  review: string | null;
  season: number | null;
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
}

const none = "none";

const episodeOptions = (season: TmdbSeasonDetail | undefined) => {
  if (season === undefined) {
    return [{ label: "Choose an episode", value: none }];
  }
  return [
    { label: "Choose an episode", value: none },
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
  seasons,
  tmdbId,
}: Omit<LogSheetProps, "formKey" | "open" | "title">) => {
  const today = useToday();
  const errorId = useId();
  const queryClient = useQueryClient();
  const isTv = mediaType === "tv";
  const [stars, setStars] = useState(() => ratingToStars(entry?.rating ?? null));
  const [review, setReview] = useState(() => entry?.review ?? "");
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
      watchedOn: resolvedDate,
    };
    try {
      await (entry === null
        ? logWatch.mutateAsync({ mediaType, tmdbId, ...fields })
        : updateWatch.mutateAsync({ id: entry.id, ...fields }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.library.list.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.watch.list.key() }),
      ]);
      onOpenChange(false);
    } catch {
      setError("We could not save this watch. Check your connection and try again.");
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
        description="Clear the date if you do not remember the day."
        label="Watch date"
        placeholder="Unknown"
        showToday
        value={resolvedDate === null ? undefined : fromIsoDate(resolvedDate)}
        onChange={(date) => setWatchedOn(date === undefined ? null : toIsoDate(date))}
      />
      <Rating
        allowClear
        allowHalf
        emptyLabel="No rating"
        label="Rating"
        max={5}
        value={stars}
        onChange={setStars}
      />
      <Textarea
        description="Only you can see this."
        label="Review"
        rows={4}
        value={review}
        onChange={(event) => setReview(event.target.value)}
      />
      {isTv ? (
        <div className={styles.pair}>
          <Select
            label="Season"
            options={[
              { label: "Whole series", value: none },
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
            label="Episode"
            options={episodeOptions(seasonQuery.data)}
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
          Cancel
        </Button>
        <Button disabled={!canSave} loading={pending} type="submit">
          {entry === null ? "Save watch" : "Save changes"}
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
  open,
  seasons,
  title,
  tmdbId,
}: LogSheetProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      description={`Private to you. ${title}.`}
      title={entry === null ? "Log a watch" : "Edit watch"}
    >
      {open ? (
        <LogForm
          key={formKey}
          entry={entry}
          mediaType={mediaType}
          seasons={seasons}
          tmdbId={tmdbId}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </DialogContent>
  </Dialog>
);
