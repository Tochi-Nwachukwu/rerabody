/**
 * Empties the e2e database (only E2E_DATABASE_URL) so every Playwright run
 * starts from the seed. Tables are truncated; the migration history is kept.
 */
import "dotenv/config";

import { Client } from "pg";

async function main() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL is not set");
  const name = new URL(url).pathname.slice(1);
  if (!/e2e|test/i.test(name))
    throw new Error(
      `Refusing to reset "${name}": the e2e database name must contain "e2e" or "test"`,
    );
  const client = new Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length) {
    await client.query(
      `TRUNCATE TABLE ${rows.map((r) => `"public"."${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`,
    );
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
