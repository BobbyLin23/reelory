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
import { useI18n } from "@/i18n/i18n";
import type { Locale } from "@/i18n/locale";
import { translate } from "@/i18n/messages";
import { tmdbImageUrl } from "@/utils/media";
import { orpc } from "@/utils/orpc";

import { ListNameForm } from "./list-name-form";
import type { ListTitle } from "./use-list-titles";
import { listTitleKey, useListTitles } from "./use-list-titles";

import styles from "./lists.module.css";

export const countLabel = (count: number, locale: Locale) =>
  count === 0 ? translate(locale, "count.noTitles") : translate(locale, "count.titles", { count });

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
}) => {
  const { locale } = useI18n();

  return (
    <li>
      <Link className={styles.listCard} to={`/lists/${list.id}`}>
        <Collage preview={list.preview} titles={titles} />
        <span className={styles.listCardCopy}>
          <span className={styles.listCardName}>{list.name}</span>
          <span className={styles.meta}>{countLabel(list.itemCount, locale)}</span>
        </span>
      </Link>
    </li>
  );
};

export const Lists = () => {
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const listsQuery = useQuery(orpc.lists.overview.queryOptions());
  const lists: ListSummary[] = listsQuery.data ?? [];
  const titles = useListTitles(lists.flatMap((list) => list.preview));

  const header = (
    <header className={styles.pageHeader}>
      <PageIntro description={t("lists.description")} title={t("lists.title")} />
      <Button type="button" onClick={() => setCreateOpen(true)}>
        {t("lists.new")}
      </Button>
    </header>
  );

  let body: ReactNode;
  if (listsQuery.isError) {
    body = (
      <Alert title={t("lists.loadError")} tone="danger">
        <Button type="button" variant="secondary" onClick={() => listsQuery.refetch()}>
          {t("common.tryAgain")}
        </Button>
      </Alert>
    );
  } else if (listsQuery.isPending) {
    body = <Skeleton label={t("lists.loading")} lines={6} />;
  } else if (lists.length === 0) {
    body = (
      <EmptyState
        description={t("lists.emptyDescription")}
        icon={<ListVideo aria-hidden="true" size={20} />}
        title={t("lists.emptyTitle")}
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
          closeLabel={t("arc.dialog.close")}
          description={t("lists.createDescription")}
          title={t("lists.createTitle")}
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
