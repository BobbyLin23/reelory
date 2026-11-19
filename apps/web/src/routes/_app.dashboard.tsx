import { getAuth } from "@clerk/react-router/server";
import { redirect } from "react-router";

import { PageIntro } from "@/components/page-intro";

import type { Route } from "./+types/_app.dashboard";

export const meta = () => [{ title: "Dashboard · reelory" }];

export const loader = async (args: Route.LoaderArgs) => {
  const { userId } = await getAuth(args);

  if (!userId) {
    const returnTo = new URL(args.request.url);
    throw redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo.toString())}`);
  }

  return { userId };
};

const Dashboard = () => (
  <PageIntro
    title="Dashboard"
    description="Your account at a glance, with the films and people you follow."
  />
);

export default Dashboard;
