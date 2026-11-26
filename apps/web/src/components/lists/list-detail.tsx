import type { TmdbMediaSummary } from "@reelory/api/tmdb/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ListVideo, SearchX, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
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

interface ListItemRef extends TitleRef {
  id: string;
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

interface TitleDrag {
  hintId: string;
  onClickCapture: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLSpanElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLAnchorElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLSpanElement>) => void;
}

const TitleCard = ({
  drag,
  listName,
  onRemove,
  title,
  titleRef,
  removing,
}: {
  drag: TitleDrag;
  listName: string;
  onRemove: () => void;
  removing: boolean;
  title: ListTitle | null | undefined;
  titleRef: TitleRef;
}) => {
  const { locale, t } = useI18n();
  const poster = tmdbImageUrl(title?.posterPath ?? null, "w500");
  return (
    <>
      <Link
        aria-describedby={drag.hintId}
        className={styles.titleLink}
        draggable={false}
        to={`/title/${titleRef.mediaType}/${titleRef.tmdbId}`}
        onClickCapture={drag.onClickCapture}
        onKeyDown={drag.onKeyDown}
      >
        <span
          aria-hidden="true"
          className={styles.poster}
          onContextMenu={drag.onContextMenu}
          onPointerCancel={drag.onPointerCancel}
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
        >
          {poster === null ? null : <img alt="" draggable={false} src={poster} />}
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
        <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
      </Button>
    </>
  );
};

interface DragState {
  from: number;
  itemId: string;
  over: number;
  pointerId: number;
  rects: DOMRect[];
  startX: number;
  startY: number;
  x: number;
  y: number;
}

interface PendingDrag {
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/** A mouse has to move this far before the press becomes a drag instead of a click. */
const DRAG_THRESHOLD_PX = 5;
/** On touch, a still finger starts a reorder after this long; a moving finger scrolls. */
const HOLD_TO_DRAG_MS = 250;
const TOUCH_SCROLL_SLOP_PX = 8;
/** A press that reordered the list still emits a click; ignore that click for a moment. */
const CLICK_SUPPRESS_MS = 500;

/** The card nearest the pointer, measured from the grid as it was when the drag began. */
const nearestIndex = (rects: DOMRect[], x: number, y: number) => {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const [index, rect] of rects.entries()) {
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }
  return nearest;
};

const moveId = (ids: string[], from: number, to: number): string[] | null => {
  const moved = ids[from];
  if (moved === undefined || from === to) {
    return null;
  }
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

const TitleGrid = ({
  items,
  listName,
  onRemove,
  onReorder,
  removingKey,
  titles,
}: {
  items: ListItemRef[];
  listName: string;
  onRemove: (ref: TitleRef) => void;
  onReorder: (itemIds: string[]) => void;
  removingKey: string | null;
  titles: Map<string, ListTitle | null>;
}) => {
  const { locale, t } = useI18n();
  const grid = useRef<HTMLUListElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pendingRef = useRef<PendingDrag | null>(null);
  const suppressClickUntil = useRef(0);
  const touchMoveGuard = useRef<((event: TouchEvent) => void) | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const hintId = useId();
  const ids = items.map((item) => item.id);

  const setDragState = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const clearPending = () => {
    const current = pendingRef.current;
    if (current !== null && current.timer !== null) {
      clearTimeout(current.timer);
    }
    pendingRef.current = null;
  };

  const stopTouchGuard = () => {
    if (touchMoveGuard.current !== null) {
      document.removeEventListener("touchmove", touchMoveGuard.current);
      touchMoveGuard.current = null;
    }
  };

  useEffect(
    () => () => {
      const current = pendingRef.current;
      if (current !== null && current.timer !== null) {
        clearTimeout(current.timer);
      }
      stopTouchGuard();
    },
    [],
  );

  const announceMove = (index: number, position: number) => {
    const item = items[index];
    if (item === undefined) {
      return;
    }
    setAnnouncement(
      t("lists.moved", {
        count: items.length,
        position,
        title: titleName(titles.get(listTitleKey(item)), locale),
      }),
    );
  };

  const move = (from: number, to: number) => {
    const next = moveId(ids, from, to);
    if (next === null) {
      return;
    }
    announceMove(from, to + 1);
    onReorder(next);
  };

  const beginDrag = (index: number, pointerId: number, x: number, y: number, touch: boolean) => {
    const item = items[index];
    const cards = grid.current?.children;
    if (item === undefined || cards === undefined) {
      return;
    }
    const rects = Array.from(cards, (card) => card.getBoundingClientRect());
    setDragState({
      from: index,
      itemId: item.id,
      over: index,
      pointerId,
      rects,
      startX: x,
      startY: y,
      x,
      y,
    });
    if (touch) {
      // The finger held still, so the page must not start scrolling under the drag.
      const guard = (event: TouchEvent) => event.preventDefault();
      touchMoveGuard.current = guard;
      document.addEventListener("touchmove", guard, { passive: false });
    }
  };

  const pointerDown = (event: ReactPointerEvent<HTMLSpanElement>, index: number) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if (pendingRef.current !== null || dragRef.current !== null) {
      return;
    }
    const { pointerId } = event;
    const pending: PendingDrag = {
      index,
      pointerId,
      startX: event.clientX,
      startY: event.clientY,
      timer: null,
    };
    if (event.pointerType === "mouse") {
      try {
        event.currentTarget.setPointerCapture(pointerId);
      } catch {
        // Without capture the drag still follows the pointer over the poster.
      }
      pendingRef.current = pending;
      return;
    }
    pending.timer = setTimeout(() => {
      const current = pendingRef.current;
      if (current === null || current.pointerId !== pointerId) {
        return;
      }
      pendingRef.current = null;
      beginDrag(current.index, current.pointerId, current.startX, current.startY, true);
    }, HOLD_TO_DRAG_MS);
    pendingRef.current = pending;
  };

  const pointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const active = dragRef.current;
    if (active !== null) {
      if (active.pointerId !== event.pointerId) {
        return;
      }
      setDragState({
        ...active,
        over: nearestIndex(active.rects, event.clientX, event.clientY),
        x: event.clientX,
        y: event.clientY,
      });
      return;
    }
    const waiting = pendingRef.current;
    if (waiting === null || waiting.pointerId !== event.pointerId) {
      return;
    }
    const distance = Math.hypot(event.clientX - waiting.startX, event.clientY - waiting.startY);
    if (event.pointerType === "touch") {
      // A finger that moves is scrolling the page; only a held finger reorders.
      if (distance > TOUCH_SCROLL_SLOP_PX) {
        clearPending();
      }
      return;
    }
    if (distance < DRAG_THRESHOLD_PX) {
      return;
    }
    const { index, pointerId } = waiting;
    clearPending();
    beginDrag(index, pointerId, event.clientX, event.clientY, false);
  };

  const pointerUp = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const waiting = pendingRef.current;
    if (waiting !== null && waiting.pointerId === event.pointerId) {
      clearPending();
    }
    const active = dragRef.current;
    if (active === null || active.pointerId !== event.pointerId) {
      return;
    }
    setDragState(null);
    stopTouchGuard();
    suppressClickUntil.current = performance.now() + CLICK_SUPPRESS_MS;
    move(active.from, active.over);
  };

  const pointerCancel = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const waiting = pendingRef.current;
    if (waiting !== null && waiting.pointerId === event.pointerId) {
      clearPending();
    }
    const active = dragRef.current;
    if (active === null || active.pointerId !== event.pointerId) {
      return;
    }
    setDragState(null);
    stopTouchGuard();
    suppressClickUntil.current = performance.now() + CLICK_SUPPRESS_MS;
  };

  const clickCapture = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (performance.now() >= suppressClickUntil.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    suppressClickUntil.current = 0;
  };

  const contextMenu = (event: ReactMouseEvent<HTMLSpanElement>) => {
    if (dragRef.current !== null || performance.now() < suppressClickUntil.current) {
      event.preventDefault();
    }
  };

  // Arrow keys walk the reading order, so a keyboard user reorders without a pointer.
  const reorderWithKeys = (event: ReactKeyboardEvent<HTMLAnchorElement>, index: number) => {
    let step = 0;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      step = -1;
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      step = 1;
    }
    if (step === 0) {
      return;
    }
    event.preventDefault();
    move(index, Math.min(ids.length - 1, Math.max(0, index + step)));
  };

  return (
    <>
      <p className="sr-only" id={hintId}>
        {t("lists.reorderHint")}
      </p>
      <output aria-live="polite" className="sr-only">
        {announcement}
      </output>
      <ul
        className={styles.titleGrid}
        data-reordering={drag === null ? undefined : "true"}
        ref={grid}
      >
        {items.map((titleRef, index) => {
          const key = listTitleKey(titleRef);
          const dragging = drag?.itemId === titleRef.id;
          const target = drag !== null && drag.over === index && drag.over !== drag.from;
          return (
            <li
              className={styles.titleCard}
              data-dragging={dragging ? "true" : undefined}
              data-target={target ? "true" : undefined}
              key={titleRef.id}
              style={
                drag !== null && dragging
                  ? {
                      transform: `translate3d(${drag.x - drag.startX}px, ${drag.y - drag.startY}px, 0)`,
                    }
                  : undefined
              }
            >
              <TitleCard
                drag={{
                  hintId,
                  onClickCapture: clickCapture,
                  onContextMenu: contextMenu,
                  onKeyDown: (event) => reorderWithKeys(event, index),
                  onPointerCancel: pointerCancel,
                  onPointerDown: (event) => pointerDown(event, index),
                  onPointerMove: pointerMove,
                  onPointerUp: pointerUp,
                }}
                listName={listName}
                removing={removingKey === key}
                title={titles.get(key)}
                titleRef={titleRef}
                onRemove={() => onRemove(titleRef)}
              />
            </li>
          );
        })}
      </ul>
    </>
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
  const items: ListItemRef[] = listQuery.data?.items ?? [];
  const titles = useListTitles(items);
  const renameList = useMutation(orpc.lists.rename.mutationOptions());
  const deleteList = useMutation(orpc.lists.delete.mutationOptions());
  const addItem = useMutation(orpc.lists.addItem.mutationOptions());
  const removeItem = useMutation(orpc.lists.removeItem.mutationOptions());
  const reorderItems = useMutation(orpc.lists.reorder.mutationOptions());
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const queuedOrder = useRef<string[] | null>(null);

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

  // The new order shows at once. Saves run one after another and send only the
  // latest order, so quick arrow presses cannot race or get dropped.
  const reorderTitles = (itemIds: string[]) => {
    const previous = listQuery.data;
    if (previous === undefined) {
      return;
    }
    setActionError(null);
    const byId = new Map(previous.items.map((item) => [item.id, item]));
    const ordered = itemIds.flatMap((id) => {
      const item = byId.get(id);
      return item === undefined ? [] : [item];
    });
    const { queryKey } = orpc.lists.get.queryOptions({ input: { id: listId } });
    queryClient.setQueryData(queryKey, { ...previous, items: ordered });
    queuedOrder.current = itemIds;
    saveQueue.current = saveQueue.current.then(async () => {
      const next = queuedOrder.current;
      if (next === null) {
        return;
      }
      queuedOrder.current = null;
      try {
        await reorderItems.mutateAsync({ id: listId, itemIds: next });
      } catch {
        setActionError(t("lists.reorderError"));
      }
      if (queuedOrder.current === null) {
        await refresh();
      }
    });
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
        {items.length > 1 ? <p className={styles.note}>{t("lists.reorderNote")}</p> : null}
        {items.length === 0 ? (
          <EmptyState
            description={t("lists.emptyListDescription")}
            icon={<ListVideo aria-hidden="true" size={20} />}
            title={t("lists.emptyListTitle")}
          />
        ) : (
          <TitleGrid
            items={items}
            listName={list.name}
            removingKey={removingKey}
            titles={titles}
            onRemove={(titleRef) => {
              void removeTitle(titleRef);
            }}
            onReorder={reorderTitles}
          />
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
