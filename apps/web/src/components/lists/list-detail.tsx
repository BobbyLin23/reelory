import type { TmdbMediaSummary } from "@reelory/api/tmdb/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ListVideo, SearchX, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { InlineEdit } from "@/components/arc/inline-edit/inline-edit";
import { SearchField } from "@/components/arc/search-field/search-field";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { errorCode } from "@/components/title-page/use-title-page";
import type { MediaType } from "@/utils/media";
import { tmdbImageUrl, yearFromDate } from "@/utils/media";
import { orpc } from "@/utils/orpc";

import { countLabel } from "./lists";
import type { ListTitle } from "./use-list-titles";
import { listTitleKey, useListTitles } from "./use-list-titles";

import styles from "./lists.module.css";

const SEARCH_DEBOUNCE_MS = 300;

const KIND_LABEL: Record<MediaType, string> = { movie: "Film", tv: "Series" };

interface TitleRef {
  mediaType: MediaType;
  tmdbId: number;
}

type TitleSummary = Extract<TmdbMediaSummary, { mediaType: "movie" | "tv" }>;

const isTitle = (result: TmdbMediaSummary): result is TitleSummary => result.mediaType !== "person";

const titleName = (title: ListTitle | null | undefined) => {
  if (title === undefined) {
    return "Loading title";
  }
  return title?.title ?? "Title unavailable";
};

const titleMeta = (title: ListTitle | null | undefined, mediaType: MediaType) => {
  if (title === undefined) {
    return "Loading";
  }
  if (title === null) {
    return "Not available from TMDB";
  }
  return `${title.year ?? "No year"} · ${KIND_LABEL[mediaType]}`;
};

const TitleCard = ({
  listName,
  onRemove,
  title,
  titleRef,
  removing,
}: {
  listName: string;
  onRemove: () => void;
  removing: boolean;
  title: ListTitle | null | undefined;
  titleRef: TitleRef;
}) => {
  const poster = tmdbImageUrl(title?.posterPath ?? null, "w500");
  return (
    <li className={styles.titleCard}>
      <Link className={styles.titleLink} to={`/title/${titleRef.mediaType}/${titleRef.tmdbId}`}>
        <span aria-hidden="true" className={styles.poster}>
          {poster === null ? null : <img alt="" src={poster} />}
        </span>
        <span className={styles.titleCopy}>
          <span className={styles.cardTitle}>{titleName(title)}</span>
          <span className={styles.meta}>{titleMeta(title, titleRef.mediaType)}</span>
        </span>
      </Link>
      <Button
        aria-label={`Remove ${title?.title ?? "this title"} from ${listName}`}
        className={styles.removeButton}
        loading={removing}
        size="sm"
        type="button"
        variant="ghost"
        onClick={onRemove}
      >
        <X aria-hidden="true" size={14} strokeWidth={2} />
        Remove
      </Button>
    </li>
  );
};

const SearchResults = ({
  addingKey,
  inList,
  onAdd,
  query,
}: {
  addingKey: string | null;
  inList: Set<string>;
  onAdd: (ref: TitleRef) => void;
  query: string;
}) => {
  const search = useQuery(orpc.tmdb.search.queryOptions({ input: { query } }));
  const results = (search.data?.results ?? []).filter(isTitle);
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

  if (search.isPending) {
    return <Skeleton label="Loading search results" lines={5} />;
  }

  if (results.length === 0) {
    return (
      <EmptyState
        description="Check the spelling, or try the title in another language."
        icon={<SearchX aria-hidden="true" size={20} />}
        title="No results for that search"
      />
    );
  }

  return (
    <section aria-labelledby="list-search-heading" className={styles.searchResults}>
      <h3 className={styles.resultsHeading} id="list-search-heading">
        Results for “{query}”
      </h3>
      <p className={styles.note}>{count}</p>
      <ul className={styles.results}>
        {results.map((result) => {
          const titleRef: TitleRef = {
            mediaType: result.mediaType,
            tmdbId: result.id,
          };
          const key = listTitleKey(titleRef);
          const title = result.mediaType === "movie" ? result.title : result.name;
          const year = yearFromDate(
            result.mediaType === "movie" ? result.releaseDate : result.firstAirDate,
          );
          const poster = tmdbImageUrl(result.posterPath, "w185");
          return (
            <li className={styles.resultRow} key={key}>
              <span aria-hidden="true" className={styles.resultPoster}>
                {poster === null ? null : <img alt="" src={poster} />}
              </span>
              <span className={styles.resultCopy}>
                <span className={styles.cardTitle}>{title}</span>
                <span className={styles.meta}>
                  {year ?? "No year"} · {KIND_LABEL[titleRef.mediaType]}
                </span>
              </span>
              {inList.has(key) ? (
                <Badge pill size="sm">
                  In this list
                </Badge>
              ) : (
                <Button
                  loading={addingKey === key}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => onAdd(titleRef)}
                >
                  Add
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const TitleSearch = ({
  addingKey,
  inList,
  onAdd,
}: {
  addingKey: string | null;
  inList: Set<string>;
  onAdd: (ref: TitleRef) => void;
}) => {
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

  // Search waits for typing to pause, so a title is added once the field settles.
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
  const waiting = settledQuery !== query.trim();

  let content: ReactNode = null;
  if (searchActive) {
    content = waiting ? (
      <Skeleton label="Searching TMDB" lines={5} />
    ) : (
      <SearchResults addingKey={addingKey} inList={inList} query={settledQuery} onAdd={onAdd} />
    );
  }

  return (
    <section aria-labelledby="add-titles-heading" className={styles.section}>
      <h2 className={styles.sectionHeading} id="add-titles-heading">
        Add titles
      </h2>
      <p className={styles.note}>Search TMDB. A title is added to the end of this list.</p>
      <SearchField
        autoComplete="off"
        label="Search films and series"
        maxLength={200}
        placeholder="Dune, Breaking Bad"
        value={query}
        onValueChange={changeQuery}
      />
      {content}
    </section>
  );
};

export const ListDetail = ({ listId }: { listId: string }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const listQuery = useQuery(orpc.lists.get.queryOptions({ input: { id: listId } }));
  const items: TitleRef[] = listQuery.data?.items ?? [];
  const titles = useListTitles(items);
  const renameList = useMutation(orpc.lists.rename.mutationOptions());
  const deleteList = useMutation(orpc.lists.delete.mutationOptions());
  const addItem = useMutation(orpc.lists.addItem.mutationOptions());
  const removeItem = useMutation(orpc.lists.removeItem.mutationOptions());

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.lists.get.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.lists.overview.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.lists.forTitle.key() }),
    ]);
  };

  if (listQuery.isError) {
    if (errorCode(listQuery.error) === "NOT_FOUND") {
      return (
        <EmptyState
          action={
            <Link className={styles.backLink} to="/lists">
              Back to lists
            </Link>
          }
          description="It may have been deleted, or the link is wrong."
          icon={<ListVideo aria-hidden="true" size={20} />}
          title="List not found"
        />
      );
    }
    return (
      <Alert title="Could not load this list" tone="danger">
        <Button type="button" variant="secondary" onClick={() => listQuery.refetch()}>
          Try again
        </Button>
      </Alert>
    );
  }

  if (listQuery.data === undefined) {
    return <Skeleton label="Loading this list" lines={6} />;
  }

  const list = listQuery.data;
  const inList = new Set(items.map(listTitleKey));
  const addingKey = addItem.isPending && addItem.variables ? listTitleKey(addItem.variables) : null;
  const removingKey =
    removeItem.isPending && removeItem.variables ? listTitleKey(removeItem.variables) : null;

  const rename = async (name: string) => {
    await renameList.mutateAsync({ id: listId, name });
    await refresh();
  };

  const addTitle = async (titleRef: TitleRef) => {
    setActionError(null);
    try {
      await addItem.mutateAsync({ listId, ...titleRef });
      await refresh();
    } catch {
      setActionError("We could not add that title. Check your connection and try again.");
    }
  };

  const removeTitle = async (titleRef: TitleRef) => {
    setActionError(null);
    try {
      await removeItem.mutateAsync({ listId, ...titleRef });
      await refresh();
    } catch {
      setActionError("We could not remove that title. Check your connection and try again.");
    }
  };

  const confirmDelete = async () => {
    await deleteList.mutateAsync({ id: listId });
    // The deleted list must not refetch: its own get would answer NOT_FOUND.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.lists.overview.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.lists.forTitle.key() }),
    ]);
    navigate("/lists");
  };

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} to="/lists">
        <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} />
        All lists
      </Link>
      <header className={styles.detailHeader}>
        <div className={styles.detailHeading}>
          <InlineEdit
            as="h1"
            label="List name"
            validate={(next) => {
              const trimmed = next.trim();
              if (trimmed === "") {
                return "Give the list a name.";
              }
              return trimmed.length > 100 ? "Keep the name under 100 characters." : null;
            }}
            value={list.name}
            variant="title"
            onSave={rename}
          />
          <p className={styles.meta}>{countLabel(items.length)}</p>
        </div>
        <ConfirmMorph
          icon={<Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />}
          label="Delete list"
          pendingLabel="Deleting"
          prompt={`Delete “${list.name}”?`}
          onConfirm={confirmDelete}
        />
      </header>
      <section aria-labelledby="list-titles-heading" className={styles.section}>
        <h2 className={styles.sectionHeading} id="list-titles-heading">
          Titles
        </h2>
        {items.length === 0 ? (
          <EmptyState
            description="Search below, or open a title and add it to this list."
            icon={<ListVideo aria-hidden="true" size={20} />}
            title="This list is empty"
          />
        ) : (
          <ul className={styles.titleGrid}>
            {items.map((titleRef) => {
              const key = listTitleKey(titleRef);
              return (
                <TitleCard
                  key={key}
                  listName={list.name}
                  removing={removingKey === key}
                  title={titles.get(key)}
                  titleRef={titleRef}
                  onRemove={() => {
                    void removeTitle(titleRef);
                  }}
                />
              );
            })}
          </ul>
        )}
      </section>
      {actionError === null ? null : (
        <p className={styles.formError} role="alert">
          {actionError}
        </p>
      )}
      <TitleSearch
        addingKey={addingKey}
        inList={inList}
        onAdd={(titleRef) => {
          void addTitle(titleRef);
        }}
      />
    </div>
  );
};
