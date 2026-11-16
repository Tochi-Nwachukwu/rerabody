import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

import "dotenv/config";

/** Migrates and seeds the e2e database, and clears the local email outbox. */
export default function globalSetup() {
  const url = process.env.E2E_DATABASE_URL!;
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  execSync("pnpm exec prisma migrate deploy", { stdio: "pipe", env });
  execSync("pnpm exec prisma db seed", { stdio: "pipe", env });
  rmSync(path.join(process.cwd(), ".emails", "outbox.jsonl"), { force: true });
}
