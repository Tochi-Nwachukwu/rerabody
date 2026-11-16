import "dotenv/config";

import { Pool } from "pg";

/** Direct SQL access to the e2e database for test setup. */
export const e2ePool = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 2 });

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await e2ePool.query(text, params);
  return res.rows as T[];
}

export const newId = () =>
  `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
