import { useLoaderData } from "react-router";

import { Stats } from "@/components/stats/stats";

export const meta = () => [{ title: "Stats · reelory" }];

/** The switcher starts on the current month and never moves past it. */
export const loader = () => ({ latestMonth: new Date().toISOString().slice(0, 7) });

const StatsRoute = () => {
  const { latestMonth } = useLoaderData<typeof loader>();

  return <Stats latestMonth={latestMonth} />;
};

export default StatsRoute;
