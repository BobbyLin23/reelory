import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ComponentProps, FocusEvent, KeyboardEvent } from "react";

import { Calendar, CalendarDayButton } from "@reelory/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@reelory/ui/components/popover";
import { calendarLocale } from "@reelory/ui/lib/calendar-locale";
import { cn } from "@reelory/ui/lib/utils";
import { useI18n } from "@/i18n/i18n";

import styles from "./watch-date-field.module.css";

interface WatchDateFieldProps {
  description?: string;
  label: string;
  placeholder: string;
  /** The chosen day, or undefined when the watch has no known date. */
  value?: Date;
  onChange: (date: Date | undefined) => void;
}

type CalendarLabels = NonNullable<ComponentProps<typeof Calendar>["labels"]>;

const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const addDays = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
const addMonths = (date: Date, amount: number) =>
  new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    Math.min(
      date.getDate(),
      new Date(date.getFullYear(), date.getMonth() + amount + 1, 0).getDate(),
    ),
  );

/** Arrow keys move by day or week, Home and End by week, PageUp and PageDown by month. */
const daySteps: Record<string, number> = {
  ArrowDown: 7,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
};

/**
 * The watch date as a single field that opens shadcn's calendar in a popover.
 * The panel is portaled, so the dialog body never clips it, and Escape closes the
 * calendar first, then the dialog on the next press. A modal dialog keeps keyboard
 * focus on its own content, so the trigger also drives the calendar: arrows move a
 * highlighted day, Enter picks it, and Backspace or Delete clears the date.
 */
export function WatchDateField({
  description,
  label,
  placeholder,
  value,
  onChange,
}: WatchDateFieldProps) {
  const { locale, t } = useI18n();
  const controlId = useId();
  const descriptionId = `${controlId}-description`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Date | undefined>(value);
  const [month, setMonth] = useState<Date | undefined>(undefined);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const shown =
    value === undefined
      ? placeholder
      : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const labels: CalendarLabels = {
    labelDayButton: (date) => dateFormatter.format(date),
    labelGrid: (date) => monthFormatter.format(date),
    labelNav: () => t("arc.calendar.navigation"),
    labelNext: () => t("arc.calendar.nextMonth"),
    labelPrevious: () => t("arc.calendar.previousMonth"),
  };
  /** Closing hands focus back to the field when the calendar had it, so Tab never lands on the page body. */
  const close = useCallback(() => {
    const inside = panelRef.current?.contains(document.activeElement) ?? false;
    setOpen(false);
    if (inside) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const openCalendar = () => {
    const start = value ?? new Date();
    setActive(start);
    setMonth(monthStart(start));
    setOpen(true);
  };

  /** Moving past a month edge brings that month into view, so the ring never sits on an outside day. */
  const moveActive = (date: Date) => {
    setActive(date);
    setMonth((current) =>
      current !== undefined &&
      current.getFullYear() === date.getFullYear() &&
      current.getMonth() === date.getMonth()
        ? current
        : monthStart(date),
    );
  };

  /**
   * Escape belongs to the calendar while it is open, and the arrow keys drive it
   * while the field keeps focus. A modal dialog dismisses on Escape from a capture
   * listener on the document, so the field claims the key at the window first.
   */
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
        return;
      }
      if (document.activeElement !== triggerRef.current) {
        return;
      }
      const current = active ?? value ?? new Date();
      const step = daySteps[event.key];
      if (step !== undefined) {
        event.preventDefault();
        event.stopImmediatePropagation();
        moveActive(addDays(current, step));
        return;
      }
      if (event.key === "PageUp" || event.key === "PageDown") {
        event.preventDefault();
        event.stopImmediatePropagation();
        moveActive(addMonths(current, event.key === "PageUp" ? -1 : 1));
        return;
      }
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        event.stopImmediatePropagation();
        moveActive(
          addDays(current, event.key === "Home" ? -current.getDay() : 6 - current.getDay()),
        );
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onChange(current);
        close();
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onChange(undefined);
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [open, active, value, close, onChange]);

  /** Tab leaving the field closes the calendar; the dialog's focus trap can also bounce focus at the panel itself. */
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    const panel = panelRef.current?.closest("[data-slot=popover-content]");
    const inPanel = next !== null && (panel?.contains(next) ?? false);
    if (open && next !== null && !inPanel && !event.currentTarget.contains(next)) {
      setOpen(false);
    }
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      openCalendar();
    }
  };

  return (
    <div className={styles.field} onBlur={onBlur}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
      </label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) {
            openCalendar();
          } else {
            setOpen(false);
          }
        }}
      >
        <PopoverTrigger
          ref={triggerRef}
          aria-describedby={description === undefined ? undefined : descriptionId}
          className={styles.trigger}
          id={controlId}
          onKeyDown={onTriggerKeyDown}
        >
          <span className={value === undefined ? styles.placeholder : undefined}>{shown}</span>
          <ChevronDown aria-hidden="true" className={styles.chevron} size={16} strokeWidth={1.75} />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="pointer-events-auto w-(--anchor-width) rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-raised)] p-0 text-[length:var(--text-sm)] shadow-[var(--shadow-floating)] ring-0"
          sideOffset={6}
        >
          <div ref={panelRef}>
            <Calendar
              className="w-full p-2 [--cell-radius:var(--radius-pill)] [--cell-size:--spacing(9)] [&_.rdp-day_button]:rounded-[var(--radius-pill)] [&_.rdp-day_button>span]:text-sm [&_.rdp-day_button>span]:opacity-100 [&_[data-today][data-selected]]:rounded-full"
              components={{
                DayButton: ({ className, ...props }) => (
                  <CalendarDayButton
                    {...props}
                    className={cn(
                      className,
                      active !== undefined &&
                        sameDay(props.day.date, active) &&
                        "ring-2 ring-[var(--foreground)] ring-inset",
                    )}
                  />
                ),
              }}
              labels={labels}
              locale={calendarLocale(locale)}
              mode="single"
              month={month}
              onMonthChange={(next) => setMonth(monthStart(next))}
              selected={value}
              onSelect={(date) => {
                if (date !== undefined) {
                  onChange(date);
                  close();
                }
              }}
            />
          </div>
          <div className={styles.footer}>
            <button
              className={styles.clear}
              disabled={value === undefined}
              type="button"
              onClick={() => {
                onChange(undefined);
                close();
              }}
            >
              {t("common.clear")}
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <span className={styles.srOnly} aria-live="polite">
        {open && active !== undefined ? dateFormatter.format(active) : ""}
      </span>
      {description === undefined ? null : (
        <span className={styles.description} id={descriptionId}>
          {description}
        </span>
      )}
    </div>
  );
}
