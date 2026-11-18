import { drizzle } from "drizzle-orm/sqlite-proxy";

import type { DatabaseConfig } from "./config";
import { relations } from "./relations";

interface D1RawResponse {
  success: boolean;
  errors: { code: number; message: string }[];
  result: { results: { columns: string[]; rows: unknown[][] } }[];
}

export function createDb(env: DatabaseConfig) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${env.CLOUDFLARE_DATABASE_ID}/raw`;

  async function query(sql: string, params: unknown[]) {
    const response = await fetch(endpoint, {
      body: JSON.stringify({ sql, params }),
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_D1_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const body = (await response.json()) as D1RawResponse;
    if (!(response.ok && body.success)) {
      const message = body.errors?.map((error) => error.message).join("; ");
      throw new Error(`D1 query failed: ${message || response.statusText}`);
    }
    return body.result[0]?.results ?? { columns: [], rows: [] };
  }

  const toObject = (columns: string[], row: unknown[]) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index]]));

  return drizzle(
    {
      all: async (sql, params, rowMode) => {
        const { columns, rows } = await query(sql, params);
        return (
          rowMode === "object"
            ? rows.map((row) => toObject(columns, row))
            : rows
        ) as never;
      },
      get: async (sql, params, rowMode) => {
        const { columns, rows } = await query(sql, params);
        const [row] = rows;
        if (!row) {
          return undefined;
        }
        return (rowMode === "object" ? toObject(columns, row) : row) as never;
      },
      run: async (sql, params) => {
        await query(sql, params);
        return [];
      },
    },
    { relations }
  );
}

export type Database = ReturnType<typeof createDb>;
