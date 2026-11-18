import type { SessionAuthObject } from "@clerk/backend";
import type { Database } from "@reelory/db";

export type Context = {
  auth: Pick<SessionAuthObject, "userId"> | null;
  db: Database;
};
