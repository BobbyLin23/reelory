import type { ListSummary } from "@reelory/api/routers/lists";
import { useQuery } from "@tanstack/react-query";
import { ListVideo } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { PageIntro } from "@/components/page-intro";
import { tmdbImageUrl } from "@/utils/media";
import { orpc } from "@/utils/orpc";

import { ListNameForm } from "./list-name-form";
import type { ListTitle } from "./use-list-titles";
import { listTitleKey, useListTitles } from "./use-list-titles";

import styles from "./lists.module.css";

export const countLabel = (count: number) =>
  count === 0 ? "No titles yet" : `${count} ${count === 1 ? "title" : "titles"}`;

const Collage = ({
  preview,
  titles,
}: {
  preview: ListSummary["preview"];
  titles: Map<string, ListTitle | null>;
}) => {
  if (preview.length === 0) {
    return (
      <div aria-hidden="true" className={styles.collageEmpty}>
        <ListVideo size={24} strokeWidth={1.5} />
      </div>
    );
  }

  const posters = Array.from({ length: 4 }, (_, index) => {
    const ref = preview[index];
    return ref === undefined
      ? null
      : tmdbImageUrl(titles.get(listTitleKey(ref))?.posterPath ?? null, "w185");
  });

  return (
    <div aria-hidden="true" className={styles.collage}>
      {posters.map((src, index) => (
        <span className={styles.collageTile} key={index}>
          {src === null ? null : <img alt="" src={src} />}
        </span>
      ))}
    </div>
  );
};

const ListCard = ({
  list,
  titles,
}: {
  list: ListSummary;
  titles: Map<string, ListTitle | null>;
}) => (
  <li>
    <Link className={styles.listCard} to={`/lists/${list.id}`}>
      <Collage preview={list.preview} titles={titles} />
      <span className={styles.listCardCopy}>
        <span className={styles.listCardName}>{list.name}</span>
        <span className={styles.meta}>{countLabel(list.itemCount)}</span>
      </span>
    </Link>
  </li>
);

export const Lists = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const listsQuery = useQuery(orpc.lists.overview.queryOptions());
  const lists: ListSummary[] = listsQuery.data ?? [];
  const titles = useListTitles(lists.flatMap((list) => list.preview));

  const header = (
    <header className={styles.pageHeader}>
      <PageIntro description="Collections only you can see." title="Lists" />
      <Button type="button" onClick={() => setCreateOpen(true)}>
        New list
      </Button>
    </header>
  );

  let body: ReactNode;
  if (listsQuery.isError) {
    body = (
      <Alert title="Could not load your lists" tone="danger">
        <Button type="button" variant="secondary" onClick={() => listsQuery.refetch()}>
          Try again
        </Button>
      </Alert>
    );
  } else if (listsQuery.isPending) {
    body = <Skeleton label="Loading your lists" lines={6} />;
  } else if (lists.length === 0) {
    body = (
      <EmptyState
        description="Choose New list to group films and series for a marathon, a genre, or a mood."
        icon={<ListVideo aria-hidden="true" size={20} />}
        title="No lists yet"
      />
    );
  } else {
    body = (
      <ul className={styles.listGrid}>
        {lists.map((list) => (
          <ListCard key={list.id} list={list} titles={titles} />
        ))}
      </ul>
    );
  }

  return (
    <div className={styles.page}>
      {header}
      {body}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          description="Name it for a mood, a genre, or a marathon. You can rename it later."
          title="New list"
        >
          <ListNameForm
            onCreated={() => {
              setCreateOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
