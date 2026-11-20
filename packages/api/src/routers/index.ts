import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { libraryRouter } from "./library";
import { tmdbRouter } from "./tmdb";
import { watchRouter } from "./watch";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  library: libraryRouter,
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    userId: context.auth.userId,
  })),
  tmdb: tmdbRouter,
  watch: watchRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
