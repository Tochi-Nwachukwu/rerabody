import { execSync } from "node:child_process";

import "dotenv/config";

/** Applies migrations to the test database once before the suite. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    throw new Error(
      "TEST_DATABASE_URL must be set to run the test suite (it is wiped between tests).",
    );
  if (url === process.env.DATABASE_URL)
    throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
  execSync("pnpm exec prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
