import type { TmdbTvDetail } from "@reelory/api/tmdb/schemas";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import type { Segment } from "@/components/arc/segmented-control/segmented-control";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { PageIntro } from "@/components/page-intro";
import { SeriesProgress } from "@/components/series-progress/series-progress";
import type { EpisodePosition, LibraryStatus, MediaType } from "@/utils/media";
import {
  LIBRARY_STATUS_ACTIONS,
  formatEpisode,
  formatStars,
  formatWatchDate,
  nextEpisode,
  tmdbImageUrl,
  toIsoDate,
} from "@/utils/media";
import { orpc } from "@/utils/orpc";

import styles from "./library-home.module.css";

interface LibraryItem {
  id: string;
  latestWatch: { rating: number | null; watchedOn: string | null } | null;
  mediaType: MediaType;
  posterPath: string | null;
  progress: { episode: number; season: number; watchedEpisodes: number } | null;
  status: LibraryStatus;
  title: string;
  tmdbId: number;
  year: number | null;
}

type LibraryView = "grid" | "list";

const VIEW_KEY = "reelory.library.view";
const VIEW_OPTIONS: Segment[] = [
  { label: "Grid", value: "grid" },
  { label: "List", value: "list" },
];
const KIND_LABEL: Record<MediaType, string> = { movie: "Film", tv: "Series" };
const EMPTY_STATES: Record<LibraryStatus, { description: string; title: string }> = {
  want: {
    description: "Titles you want to watch appear here. Open a title and choose Want.",
    title: "Nothing in Want yet",
  },
  watching: {
    description:
      "Open a title and choose Watching. Series progress appears here as you log episodes.",
    title: "Nothing in Watching yet",
  },
  watched: {
    description: "Open a title and log a watch. It appears here with its date and rating.",
    title: "Nothing watched yet",
  },
};

const isView = (value: string | null): value is LibraryView => value === "grid" || value === "list";

const isStatus = (value: string): value is LibraryStatus =>
  LIBRARY_STATUS_ACTIONS.some((action) => action.status === value);

/** Storage can be unavailable in a private window, so a failed read only means the default view. */
const readView = (): LibraryView | null => {
  try {
    const value = window.localStorage.getItem(VIEW_KEY);
    return isView(value) ? value : null;
  } catch {
    return null;
  }
};

const saveView = (view: LibraryView) => {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // The toggle still works for this visit.
  }
};

const titlePath = (entry: LibraryItem) => `/title/${entry.mediaType}/${entry.tmdbId}`;

const titleKey = (entry: LibraryItem) => `${entry.mediaType}:${entry.tmdbId}`;

interface RailItem {
  entry: LibraryItem;
  /** Undefined while the cached TMDB season data is loading or unavailable. */
  next: EpisodePosition | null | undefined;
  seasons: TmdbTvDetail["seasons"] | undefined;
  seasonsError: boolean;
}

const Poster = ({
  className,
  path,
  size,
}: {
  className: string;
  path: string | null;
  size: "w185" | "w500";
}) => {
  const src = tmdbImageUrl(path, size);
  return (
    <div aria-hidden="true" className={className}>
      {src === null ? null : <img alt="" src={src} />}
    </div>
  );
};

const WatchMeta = ({ watch }: { watch: LibraryItem["latestWatch"] }) => {
  if (watch === null || (watch.rating === null && watch.watchedOn === null)) {
    return null;
  }
  const date = formatWatchDate(watch.watchedOn);
  const rating = watch.rating === null ? null : formatStars(watch.rating);
  return (
    <p className={styles.meta}>
      <span aria-hidden="true" className={styles.watchMeta}>
        {date}
        {date !== null && rating !== null ? <span>·</span> : null}
        {rating === null ? null : (
          <span className={styles.rating}>
            <Star className={styles.star} fill="currentColor" size={12} strokeWidth={0} />
            {rating}
          </span>
        )}
      </span>
      <span className={styles.srOnly}>
        {[date, rating === null ? null : `Rated ${rating} out of 5`].filter(Boolean).join(", ")}
      </span>
    </p>
  );
};

const PosterGrid = ({ entries }: { entries: LibraryItem[] }) => (
  <ul className={styles.grid}>
    {entries.map((entry) => (
      <li key={entry.id}>
        <Link className={styles.card} to={titlePath(entry)}>
          <Poster className={styles.cardPoster} path={entry.posterPath} size="w500" />
          <div className={styles.cardCopy}>
            <p className={styles.cardTitle}>{entry.title}</p>
            <p className={styles.meta}>
              {entry.year ?? "No year"} · {KIND_LABEL[entry.mediaType]}
            </p>
            <WatchMeta watch={entry.latestWatch} />
          </div>
        </Link>
      </li>
    ))}
  </ul>
);

const DenseList = ({ entries }: { entries: LibraryItem[] }) => (
  <ul className={styles.list}>
    {entries.map((entry) => (
      <li key={entry.id}>
        <Link className={styles.row} to={titlePath(entry)}>
          <Poster className={styles.poster} path={entry.posterPath} size="w185" />
          <div className={styles.copy}>
            <p className={styles.cardTitle}>{entry.title}</p>
            <p className={styles.meta}>
              {entry.year ?? "No year"} · {KIND_LABEL[entry.mediaType]}
            </p>
            <WatchMeta watch={entry.latestWatch} />
          </div>
        </Link>
      </li>
    ))}
  </ul>
);

const ContinueWatching = ({
  items,
  onAdvance,
  pendingKey,
  saveError,
}: {
  items: RailItem[];
  onAdvance: (entry: LibraryItem, next: EpisodePosition) => void;
  pendingKey: string | null;
  saveError: boolean;
}) => (
  <section aria-labelledby="continue-watching" className={styles.railSection}>
    <div className={styles.railHeader}>
      <h2 className={styles.railHeading} id="continue-watching">
        Continue watching
      </h2>
      <p className={styles.railHint}>One tap marks the next episode watched.</p>
    </div>
    {saveError ? (
      <p className={styles.error} role="alert">
        We could not save that episode. Check your connection and try again.
      </p>
    ) : null}
    <ul className={styles.rail}>
      {items.map(({ entry, next, seasons, seasonsError }) => (
        <li className={styles.railItem} key={entry.id}>
          <Link className={styles.railLink} to={titlePath(entry)}>
            <Poster className={styles.railPoster} path={entry.posterPath} size="w185" />
            <span className={styles.railCopy}>
              <span className={styles.cardTitle}>{entry.title}</span>
            </span>
          </Link>
          {seasons === undefined ? (
            seasonsError ? (
              <p className={styles.railNote}>Episode counts are unavailable right now.</p>
            ) : (
              <Skeleton label="Loading series progress" lines={2} />
            )
          ) : (
            <SeriesProgress
              progress={entry.progress}
              seasons={seasons}
              watchedEpisodes={entry.progress?.watchedEpisodes ?? 0}
            />
          )}
          {next === undefined ? null : next === null ? (
            <p className={styles.railNote}>Every episode TMDB lists is watched.</p>
          ) : (
            <Button
              className={styles.railAction}
              loading={pendingKey === titleKey(entry)}
              type="button"
              variant="secondary"
              onClick={() => onAdvance(entry, next)}
            >
              Mark {formatEpisode(next)} watched
            </Button>
          )}
        </li>
      ))}
    </ul>
  </section>
);

export const LibraryHome = () => {
  const queryClient = useQueryClient();
  const libraryQuery = useQuery(orpc.library.overview.queryOptions());
  const [status, setStatus] = useState<LibraryStatus>("want");
  const [view, setView] = useState<LibraryView>("grid");
  const advance = useMutation({
    ...orpc.watch.log.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.library.overview.key() }),
  });
  const counts = libraryQuery.data?.counts ?? { want: 0, watched: 0, watching: 0 };
  const entries = libraryQuery.data?.entries ?? [];
  const railEntries = entries.filter(
    (entry) => entry.status === "watching" && entry.mediaType === "tv",
  );
  // Season and episode counts come from the cached TMDB season data, one cached request per series.
  const seasonQueries = useQueries({
    queries: railEntries.map((entry) =>
      orpc.tmdb.tv.detail.queryOptions({ input: { id: entry.tmdbId } }),
    ),
  });

  // The saved view is applied after hydration so the server and first client render match.
  useEffect(() => {
    const saved = readView();
    if (saved !== null) {
      setView(saved);
    }
  }, []);

  if (libraryQuery.error) {
    return (
      <div className={styles.page}>
        <PageIntro
          description="Your library of films and series, and what to watch next."
          title="Home"
        />
        <Alert title="Could not load your library" tone="danger">
          <Button type="button" variant="secondary" onClick={() => libraryQuery.refetch()}>
            Try again
          </Button>
        </Alert>
      </div>
    );
  }

  const rail: RailItem[] = railEntries.map((entry, index) => {
    const seasons = seasonQueries[index]?.data?.seasons;
    return {
      entry,
      next: seasons === undefined ? undefined : nextEpisode(seasons, entry.progress),
      seasons,
      seasonsError: seasonQueries[index]?.isError ?? false,
    };
  });
  const visible = entries.filter((entry) => entry.status === status);
  const statusOptions: Segment[] = LIBRARY_STATUS_ACTIONS.map(({ label, status: value }) => ({
    accessory: <Badge size="sm">{counts[value]}</Badge>,
    label,
    value,
  }));
  const pendingKey =
    advance.isPending && advance.variables
      ? `${advance.variables.mediaType}:${advance.variables.tmdbId}`
      : null;

  const changeView = (value: string) => {
    if (!isView(value)) {
      return;
    }
    setView(value);
    saveView(value);
  };

  const advanceEpisode = (entry: LibraryItem, next: EpisodePosition) => {
    advance.mutate({
      episode: next.episode,
      mediaType: entry.mediaType,
      season: next.season,
      tmdbId: entry.tmdbId,
      watchedOn: toIsoDate(new Date()),
    });
  };

  return (
    <div className={styles.page}>
      <PageIntro
        description="Your library of films and series, and what to watch next."
        title="Home"
      />
      <Skeleton label="Loading your library" lines={6} loading={libraryQuery.isPending}>
        <div className={styles.library}>
          <div className={styles.controls}>
            <SegmentedControl
              label="Library status"
              options={statusOptions}
              value={status}
              onValueChange={(value) => {
                if (isStatus(value)) {
                  setStatus(value);
                }
              }}
            />
            <SegmentedControl
              className={styles.viewControl}
              label="Library view"
              options={VIEW_OPTIONS}
              value={view}
              onValueChange={changeView}
            />
          </div>
          {status === "watching" && rail.length > 0 ? (
            <ContinueWatching
              items={rail}
              pendingKey={pendingKey}
              saveError={advance.isError}
              onAdvance={advanceEpisode}
            />
          ) : null}
          {visible.length === 0 ? (
            <EmptyState {...EMPTY_STATES[status]} />
          ) : view === "grid" ? (
            <PosterGrid entries={visible} />
          ) : (
            <DenseList entries={visible} />
          )}
        </div>
      </Skeleton>
    </div>
  );
};
