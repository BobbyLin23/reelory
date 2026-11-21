import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { libraryRouter } from "./library";
import { listsRouter } from "./lists";
import { preferencesRouter } from "./preferences";
import { statsRouter } from "./stats";
import { tmdbRouter } from "./tmdb";
import { watchRouter } from "./watch";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  library: libraryRouter,
  lists: listsRouter,
  preferences: preferencesRouter,
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    userId: context.auth.userId,
  })),
  stats: statsRouter,
  tmdb: tmdbRouter,
  watch: watchRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
