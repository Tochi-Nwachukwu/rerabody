import { createPrismaClient } from "@/server/prisma";

export const testDb = createPrismaClient(process.env.TEST_DATABASE_URL);

/** Empties every application table. Migrations history is kept. */
export async function resetDb() {
  const rows = await testDb.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await testDb.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
