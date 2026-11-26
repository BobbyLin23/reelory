import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useSyncExternalStore } from "react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { useI18n } from "@/i18n/i18n";
import type { MediaType } from "@/utils/media";
import { orpc } from "@/utils/orpc";

import styles from "./title-page.module.css";

const compactQuery = "(max-width: 639px)";
const subscribeCompact = (change: () => void) => {
  const query = window.matchMedia(compactQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};

interface RemoveWantDialogProps {
  mediaType: MediaType;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  tmdbId: number;
}

/** Confirming clears the signed-in user's Want entry only; dismissing changes nothing. */
export const RemoveWantDialog = ({
  mediaType,
  onOpenChange,
  open,
  title,
  tmdbId,
}: RemoveWantDialogProps) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  const removeWant = useMutation(orpc.library.removeWant.mutationOptions());
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(compactQuery).matches,
    () => false,
  );

  const close = (next: boolean) => {
    if (!next) {
      setError(null);
    }
    onOpenChange(next);
  };

  const handleRemove = async () => {
    setError(null);
    try {
      await removeWant.mutateAsync({ mediaType, tmdbId });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.library.list.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.library.overview.key() }),
      ]);
      close(false);
    } catch {
      setError(t("title.removeWantError"));
    }
  };

  const body = (
    <div className={compact ? `${styles.dialogBody} ${styles.sheetBody}` : styles.dialogBody}>
      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div
        className={compact ? `${styles.formActions} ${styles.sheetActions}` : styles.formActions}
      >
        <Button ref={cancelRef} type="button" variant="secondary" onClick={() => close(false)}>
          {t("common.cancel")}
        </Button>
        <Button
          loading={removeWant.isPending}
          type="button"
          variant="danger"
          onClick={() => void handleRemove()}
        >
          {t("title.removeWantConfirm")}
        </Button>
      </div>
    </div>
  );

  if (compact) {
    return (
      <BottomSheet
        closeLabel={t("arc.dialog.close")}
        description={t("title.removeWantDescription", { title })}
        detents={[0.45]}
        open={open}
        title={t("title.removeWantTitle")}
        onOpenChange={close}
      >
        {body}
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        closeLabel={t("arc.dialog.close")}
        description={t("title.removeWantDescription", { title })}
        title={t("title.removeWantTitle")}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
      >
        {body}
      </DialogContent>
    </Dialog>
  );
};
