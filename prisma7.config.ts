import "dotenv/config";
import { defineConfig } from "prisma/config";

// The Prisma CLI (migrate, seed, studio) uses the direct, unpooled connection.
// The app uses the pooled DATABASE_URL through the pg driver adapter in src/server/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
