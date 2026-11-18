import type { Context as ApiContext } from "@reelory/api/context";

import { db } from "./services";
type ClerkContextAuth = ApiContext["auth"];

function toClerkContextAuth(auth: ClerkContextAuth): ClerkContextAuth {
  return auth ? { userId: auth.userId } : null;
}

import { getAuth } from "@clerk/fastify";

export async function createContext(req: Parameters<typeof getAuth>[0]): Promise<ApiContext> {
  const clerkAuth = toClerkContextAuth(getAuth(req));
  return {
    db,
    auth: clerkAuth,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
