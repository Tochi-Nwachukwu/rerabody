import { rmSync } from "node:fs";
import path from "node:path";

import "dotenv/config";

/** Clears the local email outbox. The web server command migrates and seeds the e2e database. */
export default function globalSetup() {
  rmSync(path.join(process.cwd(), ".emails", "outbox.jsonl"), { force: true });
}
