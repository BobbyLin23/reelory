import { Check, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";

import { useI18n } from "@/i18n/i18n";

import styles from "./label-picker.module.css";

interface LabelPickerProps {
  description?: string;
  label: string;
  /** The labels already used on other watches, offered as suggestions. */
  options: string[];
  placeholder: string;
  value: string[];
  onChange: (labels: string[]) => void;
}

/** Mirrors the API's tag limits. */
const MAX_LABELS = 20;
const MAX_LENGTH = 50;

const sameLabel = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

const normalize = (value: string) => value.trim().slice(0, MAX_LENGTH);

export function LabelPicker({
  description,
  label,
  options,
  placeholder,
  value,
  onChange,
}: LabelPickerProps) {
  const { t } = useI18n();
  const controlId = useId();
  const listboxId = `${controlId}-listbox`;
  const descriptionId = `${controlId}-description`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dropsUp, setDropsUp] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const full = value.length >= MAX_LABELS;
  const typed = normalize(query);
  const matches = options.filter(
    (option) =>
      !value.some((label) => sameLabel(label, option)) &&
      option.toLocaleLowerCase().includes(typed.toLocaleLowerCase()),
  );
  const canCreate =
    !full &&
    typed !== "" &&
    !value.some((label) => sameLabel(label, typed)) &&
    !options.some((option) => sameLabel(option, typed));
  const choices = [
    ...matches.map((option) => ({ create: false, value: option })),
    ...(canCreate ? [{ create: true, value: typed }] : []),
  ];
  const active = activeIndex >= 0 ? choices[activeIndex] : undefined;

  const add = (next: string) => {
    const label = normalize(next);
    if (label === "" || full || value.some((existing) => sameLabel(existing, label))) {
      return;
    }
    onChange([...value, label]);
    setQuery("");
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const remove = (target: string) => {
    onChange(value.filter((label) => label !== target));
    inputRef.current?.focus();
  };

  /** The suggestion panel leaves with focus, and any typed label is kept rather than dropped. */
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next === null || !rootRef.current?.contains(next)) {
      setOpen(false);
      setActiveIndex(-1);
      if (typed !== "") {
        add(typed);
      }
    }
  };

  /**
   * The list opens below the field unless the dialog or sheet runs out of room there,
   * so it never covers the form's save actions.
   */
  useEffect(() => {
    if (!open) {
      return;
    }
    const field = rootRef.current;
    const bounds = (
      field?.closest("[role=dialog]") ?? document.documentElement
    ).getBoundingClientRect();
    setDropsUp(field !== null && bounds.bottom - field.getBoundingClientRect().bottom < 240);
    panelRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  /** Escape belongs to the suggestion list while it is open, so the dialog behind it stays up. */
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
        setActiveIndex(-1);
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [open]);

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (choices.length === 0) {
        return;
      }
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        const start = current >= choices.length ? -1 : current;
        return (start + step + choices.length) % choices.length;
      });
      return;
    }
    if (event.key === "Enter") {
      // Enter picks from the open list instead of submitting the form around it, so a
      // half-typed label is never dropped by an accidental save.
      const choice = active ?? choices[0];
      if (choice !== undefined) {
        event.preventDefault();
        add(choice.value);
        setOpen(false);
        return;
      }
      if (typed !== "") {
        event.preventDefault();
      }
      return;
    }
    if (event.key === "Backspace" && query === "" && value.length > 0) {
      event.preventDefault();
      remove(value.at(-1) ?? "");
      return;
    }
    if (event.key === "Escape" && !open) {
      setActiveIndex(-1);
    }
  };

  return (
    <div className={styles.field} ref={rootRef} onBlur={onBlur}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
      </label>
      <div className={styles.anchor}>
        <div className={styles.control} data-open={open ? "" : undefined}>
          {value.length === 0 ? null : (
            <ul aria-label={label} className={styles.chips}>
              {value.map((tag) => (
                <li key={tag}>
                  <span className={styles.chip}>
                    {tag}
                    <button
                      aria-label={t("log.tagsRemove", { name: tag })}
                      className={styles.remove}
                      tabIndex={-1}
                      type="button"
                      onClick={() => remove(tag)}
                    >
                      <X aria-hidden="true" size={12} strokeWidth={2} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={inputRef}
            aria-activedescendant={active === undefined ? undefined : `${listboxId}-${activeIndex}`}
            aria-autocomplete="list"
            aria-controls={open ? listboxId : undefined}
            aria-describedby={description === undefined ? undefined : descriptionId}
            aria-expanded={open}
            autoComplete="off"
            className={styles.input}
            disabled={full}
            id={controlId}
            placeholder={value.length === 0 ? placeholder : ""}
            role="combobox"
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onInputKeyDown}
          />
        </div>
        {open ? (
          <ul
            ref={panelRef}
            aria-label={label}
            className={styles.panel}
            data-side={dropsUp ? "top" : undefined}
            id={listboxId}
            role="listbox"
          >
            {choices.length === 0 ? (
              <li className={styles.empty}>
                {typed === "" ? t("log.tagsEmpty") : t("log.tagsNoMatch")}
              </li>
            ) : (
              choices.map((choice, index) => (
                <li key={`${choice.create ? "create" : "option"}-${choice.value}`}>
                  <button
                    aria-selected={index === activeIndex}
                    className={styles.option}
                    data-active={index === activeIndex ? "" : undefined}
                    id={`${listboxId}-${index}`}
                    role="option"
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      add(choice.value);
                      setOpen(false);
                    }}
                  >
                    {choice.create ? (
                      <>
                        <Plus aria-hidden="true" size={14} strokeWidth={1.75} />
                        {t("log.tagsCreate", { name: choice.value })}
                      </>
                    ) : (
                      <>
                        <span className={styles.optionText}>{choice.value}</span>
                        {index === activeIndex ? (
                          <Check aria-hidden="true" size={14} strokeWidth={1.75} />
                        ) : null}
                      </>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {description === undefined ? null : (
        <span className={styles.description} id={descriptionId}>
          {description}
        </span>
      )}
    </div>
  );
}
