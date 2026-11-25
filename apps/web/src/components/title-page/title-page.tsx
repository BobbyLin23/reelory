import { Check, FolderPlus } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { Carousel } from "@/components/arc/carousel/carousel";
import { ExpandableText } from "@/components/arc/expandable-text/expandable-text";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { AddToListDialog } from "@/components/lists/add-to-list-dialog";
import { useI18n } from "@/i18n/i18n";
import type { LibraryStatus } from "@/utils/media";
import { formatVote, tmdbImageUrl } from "@/utils/media";

import { LogSheet } from "./log-sheet";
import { SeriesProgressSection } from "./series-progress-section";
import { CastSection, CrewSection, SeasonsSection, WatchesSection } from "./title-sections";
import { errorCode, useTitlePage } from "./use-title-page";

import styles from "./title-page.module.css";

interface TitlePageProps {
  mediaType: "movie" | "tv";
  tmdbId: number;
}

const POSTER_LIMIT = 3;

const TitlePosters = ({ paths, title }: { paths: string[]; title: string }) => {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(() => new Set([paths[0]]));
  const alt = t("title.posterAlt", { title });
  if (paths.length < 2) {
    return (
      <img
        alt={alt}
        className={styles.poster}
        src={tmdbImageUrl(paths[0] ?? null, "w500") ?? undefined}
      />
    );
  }

  return (
    <Carousel
      index={index}
      labels={{
        chooseSlide: t("arc.carousel.choose"),
        nextSlide: t("arc.carousel.next"),
        pauseRotation: t("arc.carousel.pause"),
        previousSlide: t("arc.carousel.previous"),
        slides: t("arc.carousel.slides"),
        startRotation: t("arc.carousel.play"),
      }}
      label={t("title.postersLabel", { title })}
      slideLabel={(position, count) => t("title.posterPosition", { count, position: position + 1 })}
      slideSize="100cqw"
      onIndexChange={(next) => {
        setIndex(next);
        setLoaded((previous) => new Set(previous).add(paths[next]));
      }}
    >
      {paths.map((path) => (
        <div className={styles.poster} key={path}>
          {loaded.has(path) ? (
            <img alt={alt} src={tmdbImageUrl(path, "w500") ?? undefined} />
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
  onWant,
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
  onWant: () => void;
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
  const { locale, t } = useI18n();
  const paths = [...new Set([posterPath, ...(posters ?? []).map(({ filePath }) => filePath)])]
    .filter((path): path is string => !!path)
    .slice(0, POSTER_LIMIT);
  const wantSaved = libraryStatus === "want";

  return (
    <div className={backdropUrl === null ? styles.intro : styles.introWithBackdrop}>
      {backdropUrl === null ? null : (
        <div className={styles.canvas} data-title-canvas>
          <img alt="" className={styles.backdrop} src={backdropUrl} />
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
            <span className={styles.score}>TMDB {formatVote(voteAverage, locale)}</span>
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
              {t("title.watched")}
            </Button>
            <Button
              aria-pressed={wantSaved}
              disabled={wantSaved || pendingStatus !== null}
              loading={pendingStatus === "want" && !wantSaved}
              size="lg"
              type="button"
              variant="secondary"
              onClick={onWant}
            >
              {wantSaved ? (
                <>
                  <Check aria-hidden="true" size={16} strokeWidth={1.75} />
                  {t("title.inWantList")}
                </>
              ) : (
                t("title.wantToWatch")
              )}
            </Button>
            <Button
              aria-label={t("title.addToList")}
              size="lg"
              title={t("title.addToList")}
              type="button"
              variant="secondary"
              onClick={onAddToList}
            >
              <FolderPlus aria-hidden="true" size={18} strokeWidth={1.75} />
            </Button>
          </div>
          <span className="sr-only" role="status">
            {pendingStatus === null ? "" : t("title.savingStatus")}
          </span>
          {statusError === null ? null : (
            <p className={styles.error} role="alert">
              {statusError}
            </p>
          )}
        </div>
        {overview === "" ? null : (
          <section aria-labelledby="overview-heading" className={styles.synopsis}>
            <h2 className={styles.heading} id="overview-heading">
              {t("title.overview")}
            </h2>
            <ExpandableText
              className={styles.overview}
              lessLabel={t("common.showLess")}
              lines={3}
              moreLabel={t("common.readMore")}
            >
              {overview}
            </ExpandableText>
          </section>
        )}
      </div>
    </div>
  );
};

const TitleHeroFallback = () => {
  const { t } = useI18n();

  return (
    <div className={styles.introWithBackdrop}>
      <div className={styles.canvas} data-title-canvas />
      <div className={styles.heroSkeleton}>
        <div className={styles.posterSkeleton} />
        <Skeleton label={t("title.loading")} lines={5} />
      </div>
    </div>
  );
};

const TitleError = ({ error, onRetry }: { error: unknown; onRetry: () => Promise<unknown> }) => {
  const { t } = useI18n();

  if (errorCode(error) === "NOT_FOUND") {
    return (
      <Alert title={t("title.notFound")} tone="warning">
        {t("title.notFoundDescription")}
      </Alert>
    );
  }
  return (
    <Alert title={t("title.loadError")} tone="danger">
      <Button type="button" variant="secondary" onClick={onRetry}>
        {t("common.tryAgain")}
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
      {page.title === "" ? (
        page.detailPending ? (
          <TitleHeroFallback />
        ) : null
      ) : (
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
          onWant={() => page.handleSaveStatus("want")}
        />
      )}
      {page.isTv ? (
        <SeriesProgressSection
          isPending={page.detailPending || page.watchesPending}
          seasons={page.seasons}
          tmdbId={tmdbId}
          watches={page.watches}
          onTrack={page.handleEpisodeLogged}
        />
      ) : null}
      <CrewSection creators={page.creators} credits={page.credits} isTv={page.isTv} />
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
        onSaved={page.handleLogged}
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
