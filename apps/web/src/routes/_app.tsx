import { getAuth } from "@clerk/react-router/server";
import { Outlet, redirect } from "react-router";

import { AppShell } from "@/components/app-shell";
import { toPagePath } from "@/utils/page-path";

import type { Route } from "./+types/_app";

export const loader = async (args: Route.LoaderArgs) => {
  const { userId } = await getAuth(args);

  if (!userId) {
    const returnTo = new URL(args.request.url);
    const path = `${toPagePath(returnTo.pathname)}${returnTo.search}`;
    throw redirect(`/sign-in?redirect_url=${encodeURIComponent(path)}`);
  }

  return null;
};

export default function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
