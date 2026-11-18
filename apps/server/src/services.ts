import { createDb } from "@reelory/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
