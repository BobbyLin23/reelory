import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
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
      setError(
        add
          ? "We could not add this title to that list. Check your connection and try again."
          : "We could not remove this title from that list. Check your connection and try again.",
      );
    }
    setPendingId(null);
  };

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
    body = <Skeleton label="Loading your lists" lines={3} />;
  } else if (lists.length === 0) {
    body = <p className={styles.note}>You have no lists yet. Create one below.</p>;
  } else {
    body = (
      <ul className={styles.listRows}>
        {lists.map((list) => (
          <li className={styles.listRow} key={list.id}>
            <span className={styles.listRowName}>{list.name}</span>
            <span className={styles.listRowActions}>
              {list.hasTitle ? <Badge size="sm">Added</Badge> : null}
              <Button
                loading={pendingId === list.id}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => {
                  void changeMembership(list.id, !list.hasTitle);
                }}
              >
                {list.hasTitle ? "Remove" : "Add"}
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
        description="A title can sit in several lists. Only you can see them."
        title="Add to list"
      >
        <div className={styles.dialogBody}>
          {body}
          {error === null ? null : (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}
          <div className={styles.dialogCreate}>
            <h3 className={styles.resultsHeading}>New list</h3>
            <ListNameForm
              submitLabel="Create and add"
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
