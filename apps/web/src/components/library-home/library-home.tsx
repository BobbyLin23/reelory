import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { PageIntro } from "@/components/page-intro";
import { libraryStatusLabel, tmdbImageUrl } from "@/utils/media";
import { orpc } from "@/utils/orpc";

import styles from "./library-home.module.css";

export const LibraryHome = () => {
  const libraryQuery = useQuery(orpc.library.list.queryOptions({ input: {} }));

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

  const entries = libraryQuery.data ?? [];

  return (
    <div className={styles.page}>
      <PageIntro
        description="Your library of films and series, and what to watch next."
        title="Home"
      />
      <Skeleton label="Loading library" lines={4} loading={libraryQuery.isPending}>
        {entries.length === 0 ? (
          <EmptyState
            description="Open a title and choose Want, Watching, or Watched. It appears here."
            title="Nothing in your library yet"
          />
        ) : (
          <ul className={styles.list}>
            {entries.map((entry) => {
              const poster = tmdbImageUrl(entry.posterPath, "w185");
              return (
                <li key={entry.id}>
                  <Link className={styles.row} to={`/title/${entry.mediaType}/${entry.tmdbId}`}>
                    <div className={styles.poster}>
                      {poster === null ? null : <img alt="" src={poster} />}
                    </div>
                    <div className={styles.copy}>
                      <p className={styles.title}>{entry.title}</p>
                      <p className={styles.meta}>
                        {entry.year ?? "No year"}
                        {entry.mediaType === "tv" ? " · Series" : " · Film"}
                      </p>
                    </div>
                    <Badge pill>{libraryStatusLabel(entry.status)}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Skeleton>
    </div>
  );
};
