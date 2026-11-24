import type { TmdbMediaSummary, TmdbTitleSummary } from "@reelory/api/tmdb/schemas";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search, SearchX, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Carousel } from "@/components/arc/carousel/carousel";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { SearchField } from "@/components/arc/search-field/search-field";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { formatVote, tmdbImageUrl, yearFromDate } from "@/utils/media";
import { orpc } from "@/utils/orpc";

import styles from "./discover.module.css";

const SEARCH_DEBOUNCE_MS = 300;
const HERO_LIMIT = 6;
const ROW_LIMIT = 10;

const KIND_LABEL: Record<TmdbMediaSummary["mediaType"], string> = {
  movie: "Film",
  person: "Person",
  tv: "Series",
};

const summaryTitle = (result: TmdbMediaSummary): string =>
  result.mediaType === "movie" ? result.title : result.name;

const summaryYear = (result: TmdbMediaSummary): number | null => {
  if (result.mediaType === "movie") {
    return yearFromDate(result.releaseDate);
  }
  if (result.mediaType === "tv") {
    return yearFromDate(result.firstAirDate);
  }
  return null;
};

const summaryPoster = (result: TmdbMediaSummary): string | null =>
  result.mediaType === "person" ? result.profilePath : result.posterPath;

/** People have no page yet, so only films and series get a link. */
const titlePath = (result: TmdbMediaSummary): string | null =>
  result.mediaType === "person" ? null : `/title/${result.mediaType}/${result.id}`;

const summaryMeta = (result: TmdbMediaSummary): string => {
  if (result.mediaType === "person") {
    return "Person · No page yet";
  }
  const year = summaryYear(result);
  return year === null ? KIND_LABEL[result.mediaType] : `${year} · ${KIND_LABEL[result.mediaType]}`;
};

const PosterCard = ({ result }: { result: TmdbMediaSummary }) => {
  const poster = tmdbImageUrl(summaryPoster(result), "w500");
  const path = titlePath(result);
  const body = (
    <>
      <div aria-hidden="true" className={styles.poster}>
        {poster === null ? null : <img alt="" loading="lazy" src={poster} />}
      </div>
      <p className={styles.cardTitle} title={summaryTitle(result)}>
        {summaryTitle(result)}
      </p>
      <p className={styles.meta}>{summaryMeta(result)}</p>
    </>
  );

  if (path === null) {
    return <div className={styles.card}>{body}</div>;
  }

  return (
    <Link className={styles.card} to={path}>
      {body}
    </Link>
  );
};

const PosterGrid = ({ results }: { results: TmdbMediaSummary[] }) => (
  <ul className={styles.grid}>
    {results.map((result) => (
      <li key={`${result.mediaType}:${result.id}`}>
        <PosterCard result={result} />
      </li>
    ))}
  </ul>
);

const PosterRow = ({ results }: { results: TmdbMediaSummary[] }) => (
  <ul className={styles.row}>
    {results.map((result) => (
      <li className={styles.rowItem} key={`${result.mediaType}:${result.id}`}>
        <PosterCard result={result} />
      </li>
    ))}
  </ul>
);

const HeroSlides = ({ titles }: { titles: TmdbTitleSummary[] }) => {
  const slides = titles.filter((title) => title.backdropPath !== null).slice(0, HERO_LIMIT);

  if (slides.length === 0) {
    return null;
  }

  return (
    <Carousel label="Featured this week" slideSize="78cqw">
      {slides.map((title, index) => {
        const backdrop = tmdbImageUrl(title.backdropPath, "w780");
        const year = summaryYear(title);
        return (
          <Link
            className={styles.hero}
            key={`${title.mediaType}:${title.id}`}
            to={`/title/${title.mediaType}/${title.id}`}
          >
            <span aria-hidden="true" className={styles.heroMedia}>
              {backdrop === null ? null : (
                <img alt="" loading={index < 2 ? "eager" : "lazy"} src={backdrop} />
              )}
            </span>
            <span className={styles.heroCopy}>
              <span className={styles.heroTitle} title={summaryTitle(title)}>
                {summaryTitle(title)}
              </span>
              <span className={styles.heroMeta}>
                {title.voteAverage > 0 ? (
                  <span className={styles.score}>
                    <Star aria-hidden="true" fill="currentColor" size={14} strokeWidth={1.75} />
                    <span aria-hidden="true">{formatVote(title.voteAverage)}</span>
                    <span className={styles.visuallyHidden}>
                      Rated {formatVote(title.voteAverage)} out of 10
                    </span>
                  </span>
                ) : null}
                <span>{[year, KIND_LABEL[title.mediaType]].filter(Boolean).join(" · ")}</span>
              </span>
            </span>
          </Link>
        );
      })}
    </Carousel>
  );
};

const Hero = ({
  failed,
  pending,
  titles,
}: {
  failed: boolean;
  pending: boolean;
  titles: TmdbTitleSummary[];
}) => {
  if (failed) {
    return null;
  }
  if (pending) {
    return (
      <div aria-busy="true" className={styles.heroLoading}>
        <Skeleton label="Loading featured titles" lines={2} />
      </div>
    );
  }
  return <HeroSlides titles={titles} />;
};

interface ShelfProps {
  id: string;
  results: TmdbMediaSummary[];
  title: string;
  pending: boolean;
  failed: boolean;
  onRetry: () => void;
}

const Shelf = ({ id, results, title, pending, failed, onRetry }: ShelfProps) => {
  const [expanded, setExpanded] = useState(false);
  const canExpand = results.length > ROW_LIMIT;
  const view = expanded ? (
    <PosterGrid results={results} />
  ) : (
    <PosterRow results={results.slice(0, ROW_LIMIT)} />
  );

  const body = failed ? (
    <Alert title={`${title} is unavailable`} tone="danger">
      <p>We could not load these titles. Check your connection and try again.</p>
      <Button type="button" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </Alert>
  ) : (
    <Skeleton label={`Loading ${title}`} lines={3} loading={pending}>
      {results.length === 0 ? (
        <EmptyState
          description="Nothing to show here right now. Search for a title instead."
          icon={<Search aria-hidden="true" size={20} />}
          title="No titles right now"
        />
      ) : (
        <div id={`${id}-results`}>{view}</div>
      )}
    </Skeleton>
  );

  return (
    <section aria-labelledby={`${id}-heading`} className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.heading} id={`${id}-heading`}>
          {title}
        </h2>
        {failed || !canExpand ? null : (
          <Button
            aria-controls={`${id}-results`}
            aria-expanded={expanded}
            type="button"
            variant="ghost"
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? "Show less" : "See all"}
            {expanded ? null : <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} />}
          </Button>
        )}
      </div>
      {body}
    </section>
  );
};

const Browse = () => {
  const trending = useQuery(
    orpc.tmdb.trending.queryOptions({
      input: { mediaType: "all", window: "week" },
    }),
  );
  const topFilms = useQuery(orpc.tmdb.movie.topRated.queryOptions({ input: {} }));
  const topSeries = useQuery(orpc.tmdb.tv.topRated.queryOptions({ input: {} }));
  const upcoming = useQuery(orpc.tmdb.movie.upcoming.queryOptions({ input: {} }));
  const onTheAir = useQuery(orpc.tmdb.tv.onTheAir.queryOptions({ input: {} }));

  const titles = (trending.data?.results ?? []).filter(
    (result): result is TmdbTitleSummary => result.mediaType !== "person",
  );

  return (
    <div className={styles.browse}>
      <Hero failed={trending.isError} pending={trending.isPending} titles={titles} />
      <Shelf
        failed={trending.isError}
        id="trending"
        pending={trending.isPending}
        results={titles}
        title="Trending this week"
        onRetry={() => {
          trending.refetch();
        }}
      />
      <Shelf
        failed={topFilms.isError}
        id="top-films"
        pending={topFilms.isPending}
        results={topFilms.data?.results ?? []}
        title="Top rated films"
        onRetry={() => {
          topFilms.refetch();
        }}
      />
      <Shelf
        failed={topSeries.isError}
        id="top-series"
        pending={topSeries.isPending}
        results={topSeries.data?.results ?? []}
        title="Top rated series"
        onRetry={() => {
          topSeries.refetch();
        }}
      />
      <Shelf
        failed={upcoming.isError}
        id="upcoming"
        pending={upcoming.isPending}
        results={upcoming.data?.results ?? []}
        title="Coming soon"
        onRetry={() => {
          upcoming.refetch();
        }}
      />
      <Shelf
        failed={onTheAir.isError}
        id="on-the-air"
        pending={onTheAir.isPending}
        results={onTheAir.data?.results ?? []}
        title="On the air"
        onRetry={() => {
          onTheAir.refetch();
        }}
      />
    </div>
  );
};

const SearchResults = ({ query }: { query: string }) => {
  const search = useQuery(
    orpc.tmdb.search.queryOptions({ enabled: query !== "", input: { query } }),
  );
  const results = search.data?.results ?? [];
  const total = search.data?.totalResults ?? 0;
  const count =
    (search.data?.totalPages ?? 0) > 1
      ? `Showing ${results.length} of ${total}`
      : `${total} ${total === 1 ? "match" : "matches"}`;

  if (search.isError) {
    return (
      <Alert title="Search is unavailable" tone="danger">
        <p>We could not reach TMDB. Check your connection and try again.</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            search.refetch();
          }}
        >
          Try again
        </Button>
      </Alert>
    );
  }

  let body: ReactNode;
  if (search.isPending) {
    body = <Skeleton label="Loading search results" lines={5} />;
  } else if (results.length === 0) {
    body = (
      <EmptyState
        description="Check the spelling, or try the title in another language."
        icon={<SearchX aria-hidden="true" size={20} />}
        title="No results for that search"
      />
    );
  } else {
    body = <PosterGrid results={results} />;
  }

  return (
    <section aria-labelledby="search-results-heading" className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.heading} id="search-results-heading">
          Results for “{query}”
        </h2>
        {search.isPending ? null : <p className={styles.sectionHint}>{count}</p>}
      </div>
      {body}
    </section>
  );
};

export const Discover = () => {
  const [query, setQuery] = useState("");
  const [settledQuery, setSettledQuery] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounce.current !== null) {
        clearTimeout(debounce.current);
      }
    },
    [],
  );

  // Search waits for typing to pause; an empty field drops back to browsing at once.
  const changeQuery = (value: string) => {
    if (debounce.current !== null) {
      clearTimeout(debounce.current);
      debounce.current = null;
    }
    setQuery(value);
    const trimmed = value.trim();
    if (trimmed === "") {
      setSettledQuery("");
      return;
    }
    if (trimmed === settledQuery) {
      return;
    }
    debounce.current = setTimeout(() => setSettledQuery(trimmed), SEARCH_DEBOUNCE_MS);
  };

  const searchActive = query.trim() !== "";
  // A query still in the debounce window counts as pending too, so old results never show.
  const waitingForQuery = settledQuery !== query.trim();

  let content: ReactNode;
  if (!searchActive) {
    content = <Browse />;
  } else if (waitingForQuery) {
    content = <Skeleton label="Searching TMDB" lines={5} />;
  } else {
    content = <SearchResults query={settledQuery} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Discover</h1>
        <div className={styles.search}>
          <SearchField
            autoComplete="off"
            label="Search"
            maxLength={200}
            placeholder="Film, series, or person"
            value={query}
            onValueChange={changeQuery}
          />
        </div>
      </header>
      {content}
    </div>
  );
};
