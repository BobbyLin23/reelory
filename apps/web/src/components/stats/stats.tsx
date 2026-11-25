import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Clapperboard } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Alert } from "@/components/arc/alert/alert";
import { BarChart } from "@/components/arc/bar-chart/bar-chart";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { PageIntro } from "@/components/page-intro";
import { useI18n } from "@/i18n/i18n";
import type { Locale } from "@/i18n/locale";
import { orpc } from "@/utils/orpc";

import styles from "./stats.module.css";

export interface MonthlyStats {
  days: { day: string; watches: number }[];
  films: number;
  genres: { genre: string; titles: number }[];
  month: string;
  ratings: { rating: number; watches: number }[];
  series: number;
  titlesWatched: number;
  undatedWatches: number;
}

type StatsState =
  | { status: "loading" }
  | { status: "error"; retry: () => Promise<unknown> }
  | { status: "ready"; data: MonthlyStats };

const monthFormatter = (locale: Locale) =>
  new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC", year: "numeric" });
const dayFormatter = (locale: Locale) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" });
const axisFormatter = (locale: Locale) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" });

const monthDate = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));

const monthLabel = (month: string, locale: Locale) =>
  monthFormatter(locale).format(monthDate(month));

const shiftMonth = (month: string, offset: number) => {
  const date = monthDate(month);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
};

const dateOf = (day: string) => new Date(`${day}T00:00:00.000Z`);

const StatsHeader = ({
  latestMonth,
  month,
  onMonthChange,
}: {
  latestMonth: string;
  month: string;
  onMonthChange: (month: string) => void;
}) => {
  const { locale, t } = useI18n();
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <header className={styles.header}>
      <PageIntro title={t("stats.title")} description={t("stats.description")} />
      <nav aria-label={t("stats.monthNav")} className={styles.monthSwitcher}>
        <Button
          aria-label={t("stats.showMonth", { month: monthLabel(previous, locale) })}
          type="button"
          variant="secondary"
          onClick={() => onMonthChange(previous)}
        >
          <ChevronLeft aria-hidden="true" size={16} strokeWidth={1.75} />
        </Button>
        <p aria-live="polite" className={styles.month}>
          {monthLabel(month, locale)}
        </p>
        <Button
          aria-label={t("stats.showMonth", { month: monthLabel(next, locale) })}
          disabled={next > latestMonth}
          type="button"
          variant="secondary"
          onClick={() => onMonthChange(next)}
        >
          <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} />
        </Button>
      </nav>
    </header>
  );
};

const StatsLoading = () => {
  const { t } = useI18n();

  return (
    <>
      <section aria-busy="true" aria-label={t("stats.loadingTotals")} className={styles.metrics}>
        {[0, 1, 2, 3].map((key) => (
          <div className={styles.metricSkeleton} key={key}>
            <Skeleton label={t("stats.loadingTotals")} lines={3} />
          </div>
        ))}
      </section>
      <section aria-busy="true" aria-label={t("stats.loadingCharts")} className={styles.charts}>
        {[0, 1, 2].map((key) => (
          <section className={styles.panel} key={key}>
            <Skeleton label={t("stats.loadingCharts")} lines={5} />
          </section>
        ))}
      </section>
    </>
  );
};

const StatsEmpty = ({ label }: { label: string }) => {
  const { t } = useI18n();

  return (
    <section aria-label={t("stats.emptyRegion")} className={styles.panel}>
      <EmptyState
        action={
          <Link className={styles.browse} to="/discover">
            {t("stats.browse")}
            <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} />
          </Link>
        }
        description={t("stats.emptyDescription")}
        icon={<Clapperboard aria-hidden="true" size={20} strokeWidth={1.75} />}
        title={t("stats.emptyTitle", { month: label })}
      />
    </section>
  );
};

const StatsCharts = ({ data, label }: { data: MonthlyStats; label: string }) => {
  const { locale, t } = useI18n();
  const rated = data.ratings.some(({ watches }) => watches > 0);
  const period = label;
  const day = dayFormatter(locale);
  const axis = axisFormatter(locale);

  return (
    <div className={styles.charts}>
      <section aria-labelledby="watches-by-day" className={styles.panel}>
        <h2 className={styles.heading} id="watches-by-day">
          {t("stats.watchesByDay")}
        </h2>
        <BarChart
          categoryLabel={t("stats.day")}
          data={data.days.map(({ day: key, watches }) => ({
            axisLabel: axis.format(dateOf(key)),
            key,
            label: day.format(dateOf(key)),
            value: watches,
          }))}
          label={t("stats.watchesByDay")}
          labels={{
            explore: t("stats.exploreByDay"),
            highest: t("arc.bar.highest"),
            lowest: t("arc.bar.lowest"),
            noData: t("arc.bar.noData"),
          }}
          period={period}
          unit={t("stats.watchesUnit")}
        />
      </section>
      <section aria-labelledby="titles-by-genre" className={styles.panel}>
        <h2 className={styles.heading} id="titles-by-genre">
          {t("stats.genres")}
        </h2>
        {data.genres.length === 0 ? (
          <p className={styles.note}>{t("stats.noGenres")}</p>
        ) : (
          <BarChart
            averageLabel={t("stats.averagePerGenre")}
            categoryLabel={t("stats.genre")}
            data={data.genres.map(({ genre, titles }) => ({
              axisLabel: genre,
              key: genre,
              label: genre,
              value: titles,
            }))}
            label={t("stats.titlesByGenre")}
            labels={{
              explore: t("stats.exploreByGenre"),
              highest: t("arc.bar.highest"),
              lowest: t("arc.bar.lowest"),
              noData: t("arc.bar.noData"),
            }}
            period={period}
            unit={t("stats.titlesUnit")}
          />
        )}
      </section>
      <section aria-labelledby="rated-watches" className={styles.panel}>
        <h2 className={styles.heading} id="rated-watches">
          {t("stats.ratings")}
        </h2>
        {rated ? (
          <BarChart
            averageLabel={t("stats.averagePerScore")}
            categoryLabel={t("stats.rating")}
            data={data.ratings.map(({ rating, watches }) => ({
              axisLabel: String(rating),
              key: `rating-${rating}`,
              label: t("stats.outOf10", { rating }),
              value: watches,
            }))}
            label={t("stats.ratedWatches")}
            labels={{
              explore: t("stats.exploreByRating"),
              highest: t("arc.bar.highest"),
              lowest: t("arc.bar.lowest"),
              noData: t("arc.bar.noData"),
            }}
            period={period}
            unit={t("stats.watchesUnit")}
          />
        ) : (
          <p className={styles.note}>{t("stats.noRatings")}</p>
        )}
      </section>
    </div>
  );
};

const StatsContent = ({ data }: { data: MonthlyStats }) => {
  const { locale, t } = useI18n();
  const label = monthLabel(data.month, locale);
  const empty = data.titlesWatched === 0;
  const share = t("count.ofTitles", { count: data.titlesWatched });

  return (
    <>
      <section aria-label={t("stats.loadingTotals")} className={styles.metrics}>
        <MetricCard
          context={label}
          label={t("stats.titlesWatched")}
          locale={locale}
          value={data.titlesWatched}
        />
        <MetricCard context={share} label={t("stats.films")} locale={locale} value={data.films} />
        <MetricCard context={share} label={t("stats.series")} locale={locale} value={data.series} />
        <MetricCard
          context={t("stats.undatedContext")}
          label={t("stats.undatedWatches")}
          locale={locale}
          value={data.undatedWatches}
        />
      </section>
      {empty ? <StatsEmpty label={label} /> : <StatsCharts data={data} label={label} />}
    </>
  );
};

export const MonthlyStatsView = ({
  latestMonth,
  month,
  onMonthChange,
  state,
}: {
  latestMonth: string;
  month: string;
  onMonthChange: (month: string) => void;
  state: StatsState;
}) => {
  const { t } = useI18n();
  let content: ReactNode;
  if (state.status === "error") {
    content = (
      <Alert title={t("stats.errorTitle")} tone="danger">
        <p>{t("stats.errorHelp")}</p>
        <Button type="button" variant="secondary" onClick={() => state.retry()}>
          {t("common.tryAgain")}
        </Button>
      </Alert>
    );
  } else if (state.status === "loading") {
    content = <StatsLoading />;
  } else {
    content = <StatsContent data={state.data} />;
  }

  return (
    <div className={styles.page}>
      <StatsHeader latestMonth={latestMonth} month={month} onMonthChange={onMonthChange} />
      {content}
    </div>
  );
};

export const Stats = ({ latestMonth }: { latestMonth: string }) => {
  const [month, setMonth] = useState(latestMonth);
  // One query per selected month; React Query keeps each month it has seen.
  const stats = useQuery(orpc.stats.monthly.queryOptions({ input: { month } }));

  let state: StatsState;
  if (stats.data !== undefined) {
    state = { data: stats.data, status: "ready" };
  } else if (stats.isError) {
    state = { retry: () => stats.refetch(), status: "error" };
  } else {
    state = { status: "loading" };
  }

  return (
    <MonthlyStatsView
      latestMonth={latestMonth}
      month={month}
      onMonthChange={setMonth}
      state={state}
    />
  );
};
