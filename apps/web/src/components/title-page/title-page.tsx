import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { ExpandableText } from "@/components/arc/expandable-text/expandable-text";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import type { LibraryStatus } from "@/utils/media";
import { LIBRARY_STATUS_ACTIONS, formatVote, libraryStatusLabel } from "@/utils/media";

import { LogSheet } from "./log-sheet";
import { CastSection, SeasonsSection, WatchesSection } from "./title-sections";
import { errorCode, useTitlePage } from "./use-title-page";

import styles from "./title-page.module.css";

interface TitlePageProps {
  mediaType: "movie" | "tv";
  tmdbId: number;
}

const TitleHero = ({
  backdropUrl,
  genres,
  libraryStatus,
  onLog,
  onStatus,
  overview,
  pendingStatus,
  runtimeLabel,
  statusError,
  title,
  voteAverage,
  year,
}: {
  backdropUrl: string | null;
  genres: readonly { id: number; name: string }[];
  libraryStatus: LibraryStatus | undefined;
  onLog: () => void;
  onStatus: (status: LibraryStatus) => void;
  overview: string;
  pendingStatus: LibraryStatus | null;
  runtimeLabel: string | null;
  statusError: string | null;
  title: string;
  voteAverage: number;
  year: number | null;
}) => (
  <>
    {backdropUrl === null ? null : (
      <div className={styles.hero}>
        <img alt="" src={backdropUrl} />
      </div>
    )}
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.meta}>
        {year === null ? null : <span>{year}</span>}
        {runtimeLabel === null ? null : <span>{runtimeLabel}</span>}
        <span className={styles.score}>TMDB {formatVote(voteAverage)}</span>
        {libraryStatus === undefined ? null : (
          <Badge pill>{libraryStatusLabel(libraryStatus)}</Badge>
        )}
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
      <div className={styles.actions}>
        {LIBRARY_STATUS_ACTIONS.map(({ label, status }) => (
          <Button
            aria-pressed={libraryStatus === status}
            key={status}
            loading={pendingStatus === status}
            type="button"
            variant="secondary"
            onClick={() => onStatus(status)}
          >
            {label}
          </Button>
        ))}
        <Button type="button" onClick={onLog}>
          Log a watch
        </Button>
      </div>
      {statusError === null ? null : (
        <p className={styles.error} role="alert">
          {statusError}
        </p>
      )}
    </header>
    {overview === "" ? null : (
      <section aria-labelledby="overview-heading" className={styles.section}>
        <h2 className={styles.heading} id="overview-heading">
          Overview
        </h2>
        <ExpandableText className={styles.overview} lines={3}>
          {overview}
        </ExpandableText>
      </section>
    )}
  </>
);

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
            runtimeLabel={page.runtimeLabel}
            statusError={page.statusError}
            title={page.title}
            voteAverage={page.voteAverage}
            year={page.year}
            onLog={() => {
              page.setEditingId(null);
              page.setLogOpen(true);
            }}
            onStatus={page.handleSaveStatus}
          />
        )}
      </Skeleton>
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
