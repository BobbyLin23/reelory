import type { TmdbTvDetail } from "@reelory/api/tmdb/schemas";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/arc/dialog/dialog";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { SearchField } from "@/components/arc/search-field/search-field";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import type { Segment } from "@/components/arc/segmented-control/segmented-control";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { PageIntro } from "@/components/page-intro";
import { SeriesProgress } from "@/components/series-progress/series-progress";
import { useI18n } from "@/i18n/i18n";
import type { EpisodePosition, LibraryStatus, MediaType } from "@/utils/media";
import {
  LIBRARY_STATUSES,
  formatEpisode,
  formatStars,
  formatWatchDate,
  isLibraryStatus,
  libraryStatusLabel,
  nextEpisode,
  tmdbImageUrl,
  toIsoDate,
} from "@/utils/media";
import { orpc } from "@/utils/orpc";

import { AddTitleDialog } from "./add-title-dialog";

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

const isView = (value: string | null): value is LibraryView => value === "grid" || value === "list";

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

const kindLabel = (mediaType: MediaType, t: (key: "common.film" | "common.series") => string) =>
  t(mediaType === "movie" ? "common.film" : "common.series");

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

const LibrarySearch = ({ entries }: { entries: LibraryItem[] | undefined }) => {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const term = query.trim().toLowerCase();
  const matches = term
    ? (entries ?? []).filter((entry) => entry.title.toLowerCase().includes(term))
    : [];
  let message = "";
  if (entries?.length === 0) {
    message = t("records.searchEmpty");
  } else if (term && matches.length === 0) {
    message = t("records.searchNoMatch");
  } else if (matches.length > 0) {
    message = t("count.titlesFound", { count: matches.length });
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setQuery("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={entries === undefined} size="lg" type="button" variant="secondary">
          <Search aria-hidden="true" />
          {t("records.searchButton")}
        </Button>
      </DialogTrigger>
      <DialogContent
        closeLabel={t("arc.dialog.close")}
        description={t("records.searchDescription")}
        title={t("records.searchTitle")}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          field.current?.focus();
        }}
      >
        <div className={styles.titleSearch}>
          <SearchField
            ref={field}
            autoComplete="off"
            clearLabel={t("arc.search.clear")}
            label={t("records.searchLabel")}
            placeholder={t("records.searchPlaceholder")}
            value={query}
            onValueChange={setQuery}
          />
          <output className={!message || matches.length > 0 ? styles.srOnly : styles.searchMeta}>
            {message}
          </output>
          {matches.length > 0 ? (
            <ul aria-label={t("records.searchResultsLabel")} className={styles.searchResults}>
              {matches.map((entry) => (
                <li key={entry.id}>
                  <Link className={styles.searchResult} to={titlePath(entry)}>
                    <Poster className={styles.searchPoster} path={entry.posterPath} size="w185" />
                    <span className={styles.searchCopy}>
                      <span className={styles.cardTitle}>{entry.title}</span>
                      <span className={styles.searchMeta}>
                        {[
                          kindLabel(entry.mediaType, t),
                          entry.year,
                          libraryStatusLabel(entry.status, locale),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const WatchMeta = ({ watch }: { watch: LibraryItem["latestWatch"] }) => {
  const { locale, t } = useI18n();
  if (watch === null || (watch.rating === null && watch.watchedOn === null)) {
    return null;
  }
  const date = formatWatchDate(watch.watchedOn, locale);
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
        {[date, rating === null ? null : t("records.searchRated", { value: rating })]
          .filter(Boolean)
          .join(", ")}
      </span>
    </p>
  );
};

const TitleMeta = ({ entry }: { entry: LibraryItem }) => {
  const { t } = useI18n();

  return (
    <p className={styles.meta}>
      {entry.year ?? t("common.noYear")} · {kindLabel(entry.mediaType, t)}
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
            <TitleMeta entry={entry} />
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
            <TitleMeta entry={entry} />
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
}) => {
  const { locale, t } = useI18n();

  return (
    <section aria-labelledby="continue-watching" className={styles.railSection}>
      <div className={styles.railHeader}>
        <h2 className={styles.railHeading} id="continue-watching">
          {t("records.continueWatching")}
        </h2>
        <p className={styles.railHint}>{t("records.continueHint")}</p>
      </div>
      {saveError ? (
        <p className={styles.error} role="alert">
          {t("records.advanceError")}
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
                <p className={styles.railNote}>{t("records.episodesUnavailable")}</p>
              ) : (
                <Skeleton label={t("records.loadingProgress")} lines={2} />
              )
            ) : (
              <SeriesProgress
                progress={entry.progress}
                seasons={seasons}
                watchedEpisodes={entry.progress?.watchedEpisodes ?? 0}
              />
            )}
            {next === undefined ? null : next === null ? (
              <p className={styles.railNote}>{t("records.allWatched")}</p>
            ) : (
              <Button
                className={styles.railAction}
                loading={pendingKey === titleKey(entry)}
                type="button"
                variant="secondary"
                onClick={() => onAdvance(entry, next)}
              >
                {t("records.markWatched", { episode: formatEpisode(next, locale) })}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export const LibraryHome = () => {
  const { locale, t } = useI18n();
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

  const intro = (
    <header className={styles.pageHeader}>
      <PageIntro description={t("records.description")} title={t("records.title")} />
      <div className={styles.pageActions}>
        <LibrarySearch entries={libraryQuery.data?.entries} />
        <AddTitleDialog />
      </div>
    </header>
  );

  if (libraryQuery.error) {
    return (
      <div className={styles.page}>
        {intro}
        <Alert title={t("records.loadError")} tone="danger">
          <Button type="button" variant="secondary" onClick={() => libraryQuery.refetch()}>
            {t("common.tryAgain")}
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
  const statusOptions: Segment[] = LIBRARY_STATUSES.map((value) => ({
    accessory: <Badge size="sm">{counts[value]}</Badge>,
    label: libraryStatusLabel(value, locale),
    value,
  }));
  const viewOptions: Segment[] = [
    { label: t("records.grid"), value: "grid" },
    { label: t("records.list"), value: "list" },
  ];
  const emptyStates: Record<LibraryStatus, { description: string; title: string }> = {
    want: {
      description: t("records.emptyWantDescription"),
      title: t("records.emptyWantTitle"),
    },
    watched: {
      description: t("records.emptyWatchedDescription"),
      title: t("records.emptyWatchedTitle"),
    },
    watching: {
      description: t("records.emptyWatchingDescription"),
      title: t("records.emptyWatchingTitle"),
    },
  };
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
      {intro}
      <Skeleton label={t("records.loading")} lines={6} loading={libraryQuery.isPending}>
        <div className={styles.library}>
          <div className={styles.controls}>
            <SegmentedControl
              label={t("records.statusControl")}
              options={statusOptions}
              value={status}
              onValueChange={(value) => {
                if (isLibraryStatus(value)) {
                  setStatus(value);
                }
              }}
            />
            <SegmentedControl
              className={styles.viewControl}
              label={t("records.viewControl")}
              options={viewOptions}
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
            <EmptyState {...emptyStates[status]} />
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
