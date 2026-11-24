import { useState } from "react";

import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { Carousel } from "@/components/arc/carousel/carousel";
import { ExpandableText } from "@/components/arc/expandable-text/expandable-text";
import { Select } from "@/components/arc/select/select";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { AddToListDialog } from "@/components/lists/add-to-list-dialog";
import type { LibraryStatus } from "@/utils/media";
import { LIBRARY_STATUS_ACTIONS, formatVote, tmdbImageUrl } from "@/utils/media";

import { LogSheet } from "./log-sheet";
import { SeriesProgressSection } from "./series-progress-section";
import { CastSection, SeasonsSection, WatchesSection } from "./title-sections";
import { errorCode, useTitlePage } from "./use-title-page";

import styles from "./title-page.module.css";

interface TitlePageProps {
  mediaType: "movie" | "tv";
  tmdbId: number;
}

const STATUS_OPTIONS = LIBRARY_STATUS_ACTIONS.map(({ label, status }) => ({
  label,
  value: status,
}));
const POSTER_LIMIT = 3;

const TitlePosters = ({ paths, title }: { paths: string[]; title: string }) => {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(() => new Set([paths[0]]));
  if (paths.length < 2) {
    return (
      <img
        alt={`Poster for ${title}`}
        className={styles.poster}
        src={tmdbImageUrl(paths[0] ?? null, "w500") ?? undefined}
      />
    );
  }

  return (
    <Carousel
      index={index}
      label={`${title} posters`}
      slideLabel={(position, count) => `Poster ${position + 1} of ${count}`}
      slideSize="100cqw"
      onIndexChange={(next) => {
        setIndex(next);
        setLoaded((previous) => new Set(previous).add(paths[next]));
      }}
    >
      {paths.map((path) => (
        <div className={styles.poster} key={path}>
          {loaded.has(path) ? (
            <img alt={`Poster for ${title}`} src={tmdbImageUrl(path, "w500") ?? undefined} />
          ) : null}
        </div>
      ))}
    </Carousel>
  );
};

const TitleHero = ({
  backdropUrl,
  genres,
  libraryStatus,
  onAddToList,
  onLog,
  onStatus,
  overview,
  pendingStatus,
  posterPath,
  posters,
  runtimeLabel,
  statusError,
  title,
  voteAverage,
  year,
}: {
  backdropUrl: string | null;
  genres: readonly { id: number; name: string }[];
  libraryStatus: LibraryStatus | undefined;
  onAddToList: () => void;
  onLog: () => void;
  onStatus: (status: LibraryStatus) => void;
  overview: string;
  pendingStatus: LibraryStatus | null;
  posterPath: string | null;
  posters: readonly { filePath: string }[] | undefined;
  runtimeLabel: string | null;
  statusError: string | null;
  title: string;
  voteAverage: number;
  year: number | null;
}) => {
  const paths = [...new Set([posterPath, ...(posters ?? []).map(({ filePath }) => filePath)])]
    .filter((path): path is string => !!path)
    .slice(0, POSTER_LIMIT);

  return (
    <div className={styles.intro}>
      {backdropUrl === null ? null : (
        <div className={styles.hero}>
          <img alt="" src={backdropUrl} />
        </div>
      )}
      <div className={paths.length > 0 ? styles.withPoster : styles.withoutPoster}>
        {paths.length > 0 ? (
          <div className={styles.artwork}>
            <TitlePosters key={paths.join("|")} paths={paths} title={title} />
          </div>
        ) : null}
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.meta}>
            {year === null ? null : <span>{year}</span>}
            {runtimeLabel === null ? null : <span>{runtimeLabel}</span>}
            <span className={styles.score}>TMDB {formatVote(voteAverage)}</span>
          </p>
          {genres.length === 0 ? null : (
            <div className={styles.genres}>
              {genres.map((genre) => (
                <Badge key={genre.id} pill>
                  {genre.name}
                </Badge>
              ))}
            </div>
          )}
        </header>
        <div className={styles.recording}>
          <div className={styles.actions}>
            <Button size="lg" type="button" onClick={onLog}>
              Log a watch
            </Button>
            <Button size="lg" type="button" variant="secondary" onClick={onAddToList}>
              Add to list
            </Button>
          </div>
          <div className={styles.status}>
            <Select
              className={styles.statusTrigger}
              label="Watch status"
              options={STATUS_OPTIONS}
              placeholder="Not set"
              value={libraryStatus ?? ""}
              onValueChange={(value) => {
                const choice = LIBRARY_STATUS_ACTIONS.find(({ status }) => status === value);
                if (choice && pendingStatus === null && choice.status !== libraryStatus) {
                  onStatus(choice.status);
                }
              }}
            />
            <span className="sr-only" role="status">
              {pendingStatus === null ? "" : "Saving watch status"}
            </span>
          </div>
          {statusError === null ? null : (
            <p className={styles.error} role="alert">
              {statusError}
            </p>
          )}
        </div>
        {overview === "" ? null : (
          <section aria-labelledby="overview-heading" className={styles.synopsis}>
            <h2 className={styles.heading} id="overview-heading">
              Overview
            </h2>
            <ExpandableText className={styles.overview} lines={3}>
              {overview}
            </ExpandableText>
          </section>
        )}
      </div>
    </div>
  );
};

const TitleError = ({ error, onRetry }: { error: unknown; onRetry: () => Promise<unknown> }) => {
  if (errorCode(error) === "NOT_FOUND") {
    return (
      <Alert title="Title not found" tone="warning">
        This film or series is not in TMDB, or the link is wrong.
      </Alert>
    );
  }
  return (
    <Alert title="Could not load this title" tone="danger">
      <Button type="button" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </Alert>
  );
};

export const TitlePage = ({ mediaType, tmdbId }: TitlePageProps) => {
  const page = useTitlePage(mediaType, tmdbId);
  const [listOpen, setListOpen] = useState(false);

  if (page.detailError) {
    return <TitleError error={page.detailError} onRetry={page.handleRetryDetail} />;
  }

  return (
    <div className={styles.page}>
      <Skeleton label="Loading title" lines={6} loading={page.detailPending}>
        {page.title === "" ? null : (
          <TitleHero
            backdropUrl={page.backdropUrl}
            genres={page.genres}
            libraryStatus={page.libraryStatus}
            overview={page.overview}
            pendingStatus={page.pendingStatus}
            posterPath={page.posterPath}
            posters={page.posters}
            runtimeLabel={page.runtimeLabel}
            statusError={page.statusError}
            title={page.title}
            voteAverage={page.voteAverage}
            year={page.year}
            onAddToList={() => {
              setListOpen(true);
            }}
            onLog={() => {
              page.setEditingId(null);
              page.setLogOpen(true);
            }}
            onStatus={page.handleSaveStatus}
          />
        )}
      </Skeleton>
      {page.isTv ? (
        <SeriesProgressSection
          isPending={page.detailPending || page.watchesPending}
          seasons={page.seasons}
          tmdbId={tmdbId}
          watches={page.watches}
        />
      ) : null}
      <CastSection credits={page.credits} isPending={page.creditsPending} />
      {page.isTv ? <SeasonsSection seasons={page.seasons} /> : null}
      <WatchesSection
        isPending={page.watchesPending}
        watches={page.watches}
        onDelete={page.handleDeleteLog}
        onEdit={(id) => {
          page.setEditingId(id);
          page.setLogOpen(true);
        }}
      />
      <AddToListDialog
        mediaType={mediaType}
        open={listOpen}
        tmdbId={tmdbId}
        onOpenChange={setListOpen}
      />
      <LogSheet
        entry={page.editing}
        formKey={page.editingId ?? "new"}
        mediaType={mediaType}
        open={page.logOpen}
        seasons={page.seasons}
        title={page.title}
        tmdbId={tmdbId}
        onOpenChange={(open) => {
          page.setLogOpen(open);
          if (!open) {
            page.setEditingId(null);
          }
        }}
      />
    </div>
  );
};
