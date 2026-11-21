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

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const DAY_AXIS = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  timeZone: "UTC",
});

const monthDate = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));

const monthLabel = (month: string) => MONTH_LABEL.format(monthDate(month));

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
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <header className={styles.header}>
      <PageIntro title="Stats" description="What you watched, one month at a time." />
      <nav aria-label="Month" className={styles.monthSwitcher}>
        <Button
          aria-label={`Show ${monthLabel(previous)}`}
          type="button"
          variant="secondary"
          onClick={() => onMonthChange(previous)}
        >
          <ChevronLeft aria-hidden="true" size={16} strokeWidth={1.75} />
        </Button>
        <p aria-live="polite" className={styles.month}>
          {monthLabel(month)}
        </p>
        <Button
          aria-label={`Show ${monthLabel(next)}`}
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

const StatsLoading = () => (
  <>
    <section aria-busy="true" aria-label="Monthly totals" className={styles.metrics}>
      {[0, 1, 2, 3].map((key) => (
        <div className={styles.metricSkeleton} key={key}>
          <Skeleton lines={3} />
        </div>
      ))}
    </section>
    <section aria-busy="true" aria-label="Monthly charts" className={styles.charts}>
      {[0, 1, 2].map((key) => (
        <section className={styles.panel} key={key}>
          <Skeleton lines={5} />
        </section>
      ))}
    </section>
  </>
);

const StatsEmpty = ({ label }: { label: string }) => (
  <section aria-label="No watches this month" className={styles.panel}>
    <EmptyState
      action={
        <Link className={styles.browse} to="/discover">
          Find something to watch
          <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} />
        </Link>
      }
      description="Watches dated this month appear here. Log one from any title, or browse Discover."
      icon={<Clapperboard aria-hidden="true" size={20} strokeWidth={1.75} />}
      title={`Nothing watched in ${label}`}
    />
  </section>
);

const StatsCharts = ({ data, label }: { data: MonthlyStats; label: string }) => {
  const rated = data.ratings.some(({ watches }) => watches > 0);
  const period = label;

  return (
    <div className={styles.charts}>
      <section aria-labelledby="watches-by-day" className={styles.panel}>
        <h2 className={styles.heading} id="watches-by-day">
          Watches by day
        </h2>
        <BarChart
          categoryLabel="Day"
          data={data.days.map(({ day, watches }) => ({
            axisLabel: DAY_AXIS.format(dateOf(day)),
            key: day,
            label: DAY_LABEL.format(dateOf(day)),
            value: watches,
          }))}
          label="Watches by day"
          period={period}
          unit="watches"
        />
      </section>
      <section aria-labelledby="titles-by-genre" className={styles.panel}>
        <h2 className={styles.heading} id="titles-by-genre">
          Genres
        </h2>
        {data.genres.length === 0 ? (
          <p className={styles.note}>No saved genres for these titles.</p>
        ) : (
          <BarChart
            averageLabel="Average per genre"
            categoryLabel="Genre"
            data={data.genres.map(({ genre, titles }) => ({
              axisLabel: genre,
              key: genre,
              label: genre,
              value: titles,
            }))}
            label="Titles by genre"
            period={period}
            unit="titles"
          />
        )}
      </section>
      <section aria-labelledby="rated-watches" className={styles.panel}>
        <h2 className={styles.heading} id="rated-watches">
          Ratings
        </h2>
        {rated ? (
          <BarChart
            averageLabel="Average per score"
            categoryLabel="Rating"
            data={data.ratings.map(({ rating, watches }) => ({
              axisLabel: String(rating),
              key: `rating-${rating}`,
              label: `${rating} out of 10`,
              value: watches,
            }))}
            label="Rated watches by score"
            period={period}
            unit="watches"
          />
        ) : (
          <p className={styles.note}>No ratings this month.</p>
        )}
      </section>
    </div>
  );
};

const StatsContent = ({ data }: { data: MonthlyStats }) => {
  const label = monthLabel(data.month);
  const empty = data.titlesWatched === 0;

  return (
    <>
      <section aria-label="Monthly totals" className={styles.metrics}>
        <MetricCard context={label} label="Titles watched" value={data.titlesWatched} />
        <MetricCard context={`of ${data.titlesWatched} titles`} label="Films" value={data.films} />
        <MetricCard
          context={`of ${data.titlesWatched} titles`}
          label="Series"
          value={data.series}
        />
        <MetricCard
          context="Not in any month"
          label="Undated watches"
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
  let content: ReactNode;
  if (state.status === "error") {
    content = (
      <Alert title="Monthly stats could not load" tone="danger">
        <p>Check your connection and try again.</p>
        <Button type="button" variant="secondary" onClick={() => state.retry()}>
          Try again
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
