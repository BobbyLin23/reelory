import type { TmdbMediaSummary } from "@reelory/api/tmdb/schemas";
import { useQuery } from "@tanstack/react-query";
import { Search, SearchX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { SearchField } from "@/components/arc/search-field/search-field";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { PageIntro } from "@/components/page-intro";
import { tmdbImageUrl, yearFromDate } from "@/utils/media";
import { orpc } from "@/utils/orpc";

import styles from "./discover.module.css";

const SEARCH_DEBOUNCE_MS = 300;
const TRENDING_ROW_LIMIT = 10;

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

const MediaCard = ({ result }: { result: TmdbMediaSummary }) => {
  const poster = tmdbImageUrl(summaryPoster(result), "w500");
  const path = titlePath(result);
  const year = summaryYear(result);
  const body = (
    <>
      <div aria-hidden="true" className={styles.poster}>
        {poster === null ? null : <img alt="" src={poster} />}
      </div>
      <div className={styles.cardCopy}>
        <p className={styles.cardTitle}>{summaryTitle(result)}</p>
        {result.mediaType === "person" ? (
          <p className={styles.personMeta}>
            <Badge pill size="sm">
              Person
            </Badge>
            <span>Profile page is not available yet.</span>
          </p>
        ) : (
          <p className={styles.meta}>
            {year ?? "No year"} · {KIND_LABEL[result.mediaType]}
          </p>
        )}
      </div>
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

const MediaGrid = ({ results }: { results: TmdbMediaSummary[] }) => (
  <ul className={styles.grid}>
    {results.map((result) => (
      <li key={`${result.mediaType}:${result.id}`}>
        <MediaCard result={result} />
      </li>
    ))}
  </ul>
);

const TrendingRow = ({ results }: { results: TmdbMediaSummary[] }) => (
  <ul className={styles.row}>
    {results.map((result) => (
      <li className={styles.rowItem} key={`${result.mediaType}:${result.id}`}>
        <MediaCard result={result} />
      </li>
    ))}
  </ul>
);

const SearchHint = () => (
  <p className={styles.hint}>Search by title or name. Results update as you type.</p>
);

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
        <Button type="button" variant="secondary" onClick={() => search.refetch()}>
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
    body = <MediaGrid results={results} />;
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

const Trending = () => {
  const trending = useQuery(
    orpc.tmdb.trending.queryOptions({
      input: { mediaType: "all", window: "week" },
    }),
  );
  const [expanded, setExpanded] = useState(false);
  const results = (trending.data?.results ?? []).filter((result) => result.mediaType !== "person");
  const canExpand = results.length > TRENDING_ROW_LIMIT;
  const shown = expanded ? results : results.slice(0, TRENDING_ROW_LIMIT);
  const view = expanded ? <MediaGrid results={shown} /> : <TrendingRow results={shown} />;

  return (
    <section aria-labelledby="trending-heading" className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionCopy}>
          <h2 className={styles.heading} id="trending-heading">
            Trending this week
          </h2>
          <p className={styles.sectionHint}>What people are watching on TMDB right now.</p>
        </div>
        {canExpand ? (
          <Button
            aria-controls="trending-results"
            aria-expanded={expanded}
            type="button"
            variant="secondary"
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? "Show less" : "See all"}
          </Button>
        ) : null}
      </div>
      {trending.isError ? (
        <Alert title="Trending is unavailable" tone="danger">
          <p>We could not load what is trending. Check your connection and try again.</p>
          <Button type="button" variant="secondary" onClick={() => trending.refetch()}>
            Try again
          </Button>
        </Alert>
      ) : (
        <Skeleton
          className={styles.trendingBody}
          label="Loading trending titles"
          lines={3}
          loading={trending.isPending}
        >
          {results.length === 0 ? (
            <EmptyState
              description="There is nothing trending right now. Search for a title instead."
              icon={<Search aria-hidden="true" size={20} />}
              title="No trending titles"
            />
          ) : (
            <div id="trending-results">{view}</div>
          )}
        </Skeleton>
      )}
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

  // Search waits for typing to pause; an empty field drops back to trending at once.
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
    content = <Trending />;
  } else if (waitingForQuery) {
    content = <Skeleton label="Searching TMDB" lines={5} />;
  } else {
    content = <SearchResults query={settledQuery} />;
  }

  return (
    <div className={styles.page}>
      <PageIntro
        description="Search films, series, and people, and see what's trending."
        title="Discover"
      />
      <div className={styles.search}>
        <SearchField
          autoComplete="off"
          label="Search films, series, and people"
          maxLength={200}
          placeholder="Dune, Breaking Bad, Zendaya"
          value={query}
          onValueChange={changeQuery}
        />
        {searchActive ? null : <SearchHint />}
      </div>
      {content}
    </div>
  );
};
