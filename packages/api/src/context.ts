import type { SessionAuthObject } from "@clerk/backend";
import type { Database } from "@reelory/db";

import type { TmdbClient } from "./tmdb/client";

export type Context = {
  auth: Pick<SessionAuthObject, "userId"> | null;
  db: Database;
  tmdb: TmdbClient;
};
