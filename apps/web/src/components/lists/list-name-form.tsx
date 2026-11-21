import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { orpc } from "@/utils/orpc";

import styles from "./lists.module.css";

interface ListNameFormProps {
  onCreated?: (list: { id: string; name: string }) => void | Promise<void>;
  submitLabel?: string;
}

/** Creating a list is a single field, so the Lists tab and the title dialog share this form. */
export const ListNameForm = ({ onCreated, submitLabel = "Create list" }: ListNameFormProps) => {
  const errorId = useId();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation(orpc.lists.create.mutationOptions());
  const trimmed = name.trim();
  const canCreate = trimmed !== "" && !create.isPending;

  const submit = async () => {
    if (!canCreate) {
      return;
    }
    setError(null);
    try {
      const list = await create.mutateAsync({ name: trimmed });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.lists.overview.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.lists.forTitle.key() }),
      ]);
      setName("");
      await onCreated?.(list);
    } catch {
      setError("We could not create the list. Check your connection and try again.");
    }
  };

  return (
    <form
      aria-describedby={error === null ? undefined : errorId}
      className={styles.createForm}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Input
        autoComplete="off"
        label="Name"
        maxLength={100}
        placeholder="Films to rewatch"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Button disabled={!canCreate} loading={create.isPending} type="submit">
        {submitLabel}
      </Button>
      {error === null ? null : (
        <p className={styles.formError} id={errorId} role="alert">
          {error}
        </p>
      )}
    </form>
  );
};
