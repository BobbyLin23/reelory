import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { useI18n } from "@/i18n/i18n";
import type { MediaType } from "@/utils/media";
import { orpc } from "@/utils/orpc";

import { ListNameForm } from "./list-name-form";

import styles from "./lists.module.css";

interface AddToListDialogProps {
  mediaType: MediaType;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  tmdbId: number;
}

export const AddToListDialog = ({
  mediaType,
  onOpenChange,
  open,
  tmdbId,
}: AddToListDialogProps) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const listsQuery = useQuery(
    orpc.lists.forTitle.queryOptions({ enabled: open, input: { mediaType, tmdbId } }),
  );
  const addItem = useMutation(orpc.lists.addItem.mutationOptions());
  const removeItem = useMutation(orpc.lists.removeItem.mutationOptions());
  const lists = listsQuery.data ?? [];

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.lists.forTitle.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.lists.overview.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.lists.get.key() }),
    ]);
  };

  const changeMembership = async (listId: string, add: boolean) => {
    setError(null);
    setPendingId(listId);
    try {
      await (add
        ? addItem.mutateAsync({ listId, mediaType, tmdbId })
        : removeItem.mutateAsync({ listId, mediaType, tmdbId }));
      await refresh();
    } catch {
      setError(add ? t("addToList.addError") : t("addToList.removeError"));
    }
    setPendingId(null);
  };

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
    body = <Skeleton label={t("lists.loading")} lines={3} />;
  } else if (lists.length === 0) {
    body = <p className={styles.note}>{t("addToList.empty")}</p>;
  } else {
    body = (
      <ul className={styles.listRows}>
        {lists.map((list) => (
          <li className={styles.listRow} key={list.id}>
            <span className={styles.listRowName}>{list.name}</span>
            <span className={styles.listRowActions}>
              {list.hasTitle ? <Badge size="sm">{t("addToList.added")}</Badge> : null}
              <Button
                loading={pendingId === list.id}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => {
                  void changeMembership(list.id, !list.hasTitle);
                }}
              >
                {list.hasTitle ? t("common.remove") : t("common.add")}
              </Button>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        closeLabel={t("arc.dialog.close")}
        description={t("addToList.description")}
        title={t("addToList.title")}
      >
        <div className={styles.dialogBody}>
          {body}
          {error === null ? null : (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}
          <div className={styles.dialogCreate}>
            <h3 className={styles.resultsHeading}>{t("addToList.newList")}</h3>
            <ListNameForm
              submitLabel={t("addToList.createAndAdd")}
              onCreated={async (list) => {
                await changeMembership(list.id, true);
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
