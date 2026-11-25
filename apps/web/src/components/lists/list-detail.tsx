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
import { useI18n } from "@/i18n/i18n";
import type { Locale } from "@/i18n/locale";
import { translate } from "@/i18n/messages";
import type { MediaType } from "@/utils/media";
import { tmdbImageUrl, yearFromDate } from "@/utils/media";
import { orpc } from "@/utils/orpc";

import { countLabel } from "./lists";
import type { ListTitle } from "./use-list-titles";
import { listTitleKey, useListTitles } from "./use-list-titles";

import styles from "./lists.module.css";

const SEARCH_DEBOUNCE_MS = 300;

const kindLabel = (mediaType: MediaType, locale: Locale) =>
  translate(locale, mediaType === "movie" ? "common.film" : "common.series");

interface TitleRef {
  mediaType: MediaType;
  tmdbId: number;
}

type TitleSummary = Extract<TmdbMediaSummary, { mediaType: "movie" | "tv" }>;

const isTitle = (result: TmdbMediaSummary): result is TitleSummary => result.mediaType !== "person";

const titleName = (title: ListTitle | null | undefined, locale: Locale) => {
  if (title === undefined) {
    return translate(locale, "lists.loadingTitle");
  }
  return title?.title ?? translate(locale, "lists.titleUnavailable");
};

const titleMeta = (title: ListTitle | null | undefined, mediaType: MediaType, locale: Locale) => {
  if (title === undefined) {
    return translate(locale, "lists.loadingShort");
  }
  if (title === null) {
    return translate(locale, "lists.notInTmdb");
  }
  return `${title.year ?? translate(locale, "common.noYear")} · ${kindLabel(mediaType, locale)}`;
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
  const { locale, t } = useI18n();
  const poster = tmdbImageUrl(title?.posterPath ?? null, "w500");
  return (
    <li className={styles.titleCard}>
      <Link className={styles.titleLink} to={`/title/${titleRef.mediaType}/${titleRef.tmdbId}`}>
        <span aria-hidden="true" className={styles.poster}>
          {poster === null ? null : <img alt="" src={poster} />}
        </span>
        <span className={styles.titleCopy}>
          <span className={styles.cardTitle}>{titleName(title, locale)}</span>
          <span className={styles.meta}>{titleMeta(title, titleRef.mediaType, locale)}</span>
        </span>
      </Link>
      <Button
        aria-label={t("lists.removeFrom", {
          list: listName,
          title: title?.title ?? t("lists.titles"),
        })}
        className={styles.removeButton}
        loading={removing}
        size="sm"
        type="button"
        variant="ghost"
        onClick={onRemove}
      >
        <X aria-hidden="true" size={14} strokeWidth={2} />
        {t("common.remove")}
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
  const { locale, t } = useI18n();
  const search = useQuery(orpc.tmdb.search.queryOptions({ input: { query } }));
  const results = (search.data?.results ?? []).filter(isTitle);
  const total = search.data?.totalResults ?? 0;
  const count =
    (search.data?.totalPages ?? 0) > 1
      ? t("discover.showing", { shown: results.length, total })
      : t("count.matches", { count: total });

  if (search.isError) {
    return (
      <Alert title={t("discover.searchErrorTitle")} tone="danger">
        <p>{t("discover.searchErrorHelp")}</p>
        <Button type="button" variant="secondary" onClick={() => search.refetch()}>
          {t("common.tryAgain")}
        </Button>
      </Alert>
    );
  }

  if (search.isPending) {
    return <Skeleton label={t("discover.loadingSearch")} lines={5} />;
  }

  if (results.length === 0) {
    return (
      <EmptyState
        description={t("discover.noResultsDescription")}
        icon={<SearchX aria-hidden="true" size={20} />}
        title={t("discover.noResultsTitle")}
      />
    );
  }

  return (
    <section aria-labelledby="list-search-heading" className={styles.searchResults}>
      <h3 className={styles.resultsHeading} id="list-search-heading">
        {t("discover.resultsFor", { query })}
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
                  {year ?? t("common.noYear")} · {kindLabel(titleRef.mediaType, locale)}
                </span>
              </span>
              {inList.has(key) ? (
                <Badge pill size="sm">
                  {t("lists.inList")}
                </Badge>
              ) : (
                <Button
                  loading={addingKey === key}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => onAdd(titleRef)}
                >
                  {t("common.add")}
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

  const { t } = useI18n();
  const searchActive = query.trim() !== "";
  const waiting = settledQuery !== query.trim();

  let content: ReactNode = null;
  if (searchActive) {
    content = waiting ? (
      <Skeleton label={t("discover.searching")} lines={5} />
    ) : (
      <SearchResults addingKey={addingKey} inList={inList} query={settledQuery} onAdd={onAdd} />
    );
  }

  return (
    <section aria-labelledby="add-titles-heading" className={styles.section}>
      <h2 className={styles.sectionHeading} id="add-titles-heading">
        {t("lists.addTitles")}
      </h2>
      <p className={styles.note}>{t("lists.addTitlesDescription")}</p>
      <SearchField
        autoComplete="off"
        clearLabel={t("arc.search.clear")}
        label={t("lists.searchLabel")}
        maxLength={200}
        placeholder={t("lists.searchPlaceholder")}
        value={query}
        onValueChange={changeQuery}
      />
      {content}
    </section>
  );
};

export const ListDetail = ({ listId }: { listId: string }) => {
  const { locale, t } = useI18n();
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
              {t("lists.backToLists")}
            </Link>
          }
          description={t("lists.notFoundDescription")}
          icon={<ListVideo aria-hidden="true" size={20} />}
          title={t("lists.notFoundTitle")}
        />
      );
    }
    return (
      <Alert title={t("lists.detailLoadError")} tone="danger">
        <Button type="button" variant="secondary" onClick={() => listQuery.refetch()}>
          {t("common.tryAgain")}
        </Button>
      </Alert>
    );
  }

  if (listQuery.data === undefined) {
    return <Skeleton label={t("lists.detailLoading")} lines={6} />;
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
      setActionError(t("lists.addError"));
    }
  };

  const removeTitle = async (titleRef: TitleRef) => {
    setActionError(null);
    try {
      await removeItem.mutateAsync({ listId, ...titleRef });
      await refresh();
    } catch {
      setActionError(t("lists.removeError"));
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
        {t("lists.back")}
      </Link>
      <header className={styles.detailHeader}>
        <div className={styles.detailHeading}>
          <InlineEdit
            as="h1"
            label={t("lists.nameFieldLabel")}
            labels={{
              activate: t("arc.inline.activate"),
              cancel: t("arc.inline.cancel"),
              editHint: t("arc.inline.editHint"),
              failed: t("arc.inline.failed"),
              multilineEditHint: t("arc.inline.multilineEditHint"),
              retry: t("arc.inline.retry"),
              save: t("arc.inline.save"),
              saved: t("arc.inline.saved"),
              saving: t("arc.inline.saving"),
              valueLabel: t("arc.inline.valueLabel"),
            }}
            validate={(next) => {
              const trimmed = next.trim();
              if (trimmed === "") {
                return t("lists.nameRequired");
              }
              return trimmed.length > 100 ? t("lists.nameTooLong") : null;
            }}
            value={list.name}
            variant="title"
            onSave={rename}
          />
          <p className={styles.meta}>{countLabel(items.length, locale)}</p>
        </div>
        <ConfirmMorph
          cancelLabel={t("common.cancel")}
          confirmLabel={t("common.delete")}
          doneLabel={t("common.deleted")}
          errorLabel={t("common.errorLabel")}
          icon={<Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />}
          label={t("lists.deleteLabel")}
          pendingLabel={t("common.deleting")}
          prompt={t("lists.deletePrompt", { name: list.name })}
          retryLabel={t("common.tryAgain")}
          onConfirm={confirmDelete}
        />
      </header>
      <section aria-labelledby="list-titles-heading" className={styles.section}>
        <h2 className={styles.sectionHeading} id="list-titles-heading">
          {t("lists.titles")}
        </h2>
        {items.length === 0 ? (
          <EmptyState
            description={t("lists.emptyListDescription")}
            icon={<ListVideo aria-hidden="true" size={20} />}
            title={t("lists.emptyListTitle")}
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
