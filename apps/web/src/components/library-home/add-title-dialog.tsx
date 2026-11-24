import type { TmdbMediaSummary, TmdbTitleSummary } from "@reelory/api/tmdb/schemas";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/arc/dialog/dialog";
import { SearchField } from "@/components/arc/search-field/search-field";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { tmdbImageUrl, yearFromDate } from "@/utils/media";
import { orpc } from "@/utils/orpc";

import styles from "./library-home.module.css";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_FRESH_MS = 5 * 60 * 1000;
const ACTOR_LIMIT = 3;

const titleMatches = (results: TmdbMediaSummary[]) => {
  const matches = new Map<string, { title: TmdbTitleSummary; actor?: string }>();
  const actors = results
    .filter((result) => result.mediaType === "person")
    .filter((person) => person.knownForDepartment === "Acting" && person.knownFor?.length);

  for (const title of results) {
    if (title.mediaType !== "person") {
      matches.set(`${title.mediaType}:${title.id}`, { title });
    }
  }
  for (const actor of actors.slice(0, ACTOR_LIMIT)) {
    for (const title of actor.knownFor ?? []) {
      const key = `${title.mediaType}:${title.id}`;
      if (!matches.has(key)) {
        matches.set(key, { actor: actor.name, title });
      }
    }
  }
  return [...matches];
};

export const AddTitleDialog = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState("");
  const [composing, setComposing] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const normalized = query.trim().replaceAll(/\s+/gu, " ");
  const ready = open && !composing && normalized !== "" && normalized === settled;

  useEffect(() => {
    if (!open || composing || !normalized) {
      return;
    }
    const timer = setTimeout(() => setSettled(normalized), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, composing, normalized]);

  const search = useQuery({
    ...orpc.tmdb.search.queryOptions({ enabled: ready, input: { query: ready ? settled : "" } }),
    retry: false,
    staleTime: SEARCH_FRESH_MS,
  });

  let body: ReactNode;
  let status = "";
  if (!normalized) {
    body = null;
  } else if (!ready || search.isPending) {
    status = "Searching TMDB";
    body = <Skeleton aria-hidden="true" label="Searching TMDB" lines={3} />;
  } else if (search.isError) {
    body = (
      <Alert title="Could not search TMDB" tone="danger">
        <p>Check your connection and try again.</p>
        <Button type="button" variant="secondary" onClick={() => search.refetch()}>
          Retry search
        </Button>
      </Alert>
    );
  } else {
    const matches = titleMatches(search.data.results);
    status = matches.length === 1 ? "1 title found" : `${matches.length} titles found`;
    body =
      matches.length === 0 ? (
        <p className={styles.searchMeta}>No titles found. Try another title or actor’s name.</p>
      ) : (
        <ul aria-label="Matching titles" className={styles.searchResults}>
          {matches.map(([key, { title, actor }]) => {
            const movie = title.mediaType === "movie";
            const year = yearFromDate(movie ? title.releaseDate : title.firstAirDate);
            const poster = tmdbImageUrl(title.posterPath, "w185");

            return (
              <li key={key}>
                <Link className={styles.searchResult} to={`/title/${title.mediaType}/${title.id}`}>
                  <span aria-hidden="true" className={styles.searchPoster}>
                    {poster ? <img alt="" loading="lazy" src={poster} /> : null}
                  </span>
                  <span className={styles.searchCopy}>
                    <span className={styles.cardTitle}>{movie ? title.title : title.name}</span>
                    <span className={styles.searchMeta}>
                      {[movie ? "Film" : "Series", year, actor && `Known for: ${actor}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setSettled("");
          setComposing(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" type="button">
          <Plus aria-hidden="true" />
          Add
        </Button>
      </DialogTrigger>
      <DialogContent
        description="Open a film or series to see its details."
        title="Add a title"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          field.current?.focus();
        }}
      >
        <div className={styles.titleSearch}>
          <SearchField
            ref={field}
            autoComplete="off"
            label="Title or actor’s name"
            maxLength={200}
            placeholder="Dune, Breaking Bad, Zendaya"
            value={query}
            onCompositionEnd={() => setComposing(false)}
            onCompositionStart={() => setComposing(true)}
            onValueChange={setQuery}
          />
          <output className={styles.srOnly}>{status}</output>
          {body}
        </div>
      </DialogContent>
    </Dialog>
  );
};
