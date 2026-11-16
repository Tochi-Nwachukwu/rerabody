import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

export type { PrismaClient };

/**
 * Builds a Prisma client on the pg driver adapter. The app passes the pooled
 * DATABASE_URL. Scripts such as the seed pass DIRECT_URL.
 * Services take a client as an argument so tests can pass their own.
 */
export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
