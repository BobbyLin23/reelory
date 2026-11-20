import { createClerkClient } from "@clerk/backend";
import type { Context as ApiContext } from "@reelory/api/context";
import { createTmdbClient } from "@reelory/api/tmdb/client";
import { createDb } from "@reelory/db";

export async function createContext(request: Request, env: Env): Promise<ApiContext> {
  const clerk = createClerkClient({
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
  });
  const requestState = await clerk.authenticateRequest(request, {
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
  });
  const { userId } = requestState.toAuth() ?? {};

  return {
    auth: userId ? { userId } : null,
    db: createDb(env.DB),
    tmdb: createTmdbClient({ apiKey: env.TMDB_API_KEY, cache: env.TMDB_CACHE }),
  };
}
