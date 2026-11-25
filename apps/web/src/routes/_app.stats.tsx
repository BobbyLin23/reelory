import { useLoaderData } from "react-router";

import { Stats } from "@/components/stats/stats";
import { pageTitle } from "@/i18n/meta";

import type { Route } from "./+types/_app.stats";

export const meta: Route.MetaFunction = ({ matches }: Route.MetaArgs) => [
  { title: pageTitle(matches, "nav.stats") },
];

/** The switcher starts on the current month and never moves past it. */
export const loader = () => ({ latestMonth: new Date().toISOString().slice(0, 7) });

const StatsRoute = () => {
  const { latestMonth } = useLoaderData<typeof loader>();

  return <Stats latestMonth={latestMonth} />;
};

export default StatsRoute;
