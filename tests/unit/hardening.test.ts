import { beforeEach, describe, expect, it } from "vitest";

import { buildCsp, securityHeaders } from "@/lib/security-headers";
import { hitRateLimit } from "@/server/rate-limit-core";

import { resetDb, testDb } from "../helpers/db";

describe("rate limiting", () => {
  beforeEach(resetDb);

  it("allows up to the limit within a window, then blocks, then resets", async () => {
    const limit = { max: 3, windowSeconds: 60 };
    const t0 = 1_800_000_000_000;
    const results = [];
    for (let i = 0; i < 4; i++)
      results.push((await hitRateLimit(testDb, "app:test:1.2.3.4", limit, t0 + i * 1000)).allowed);
    expect(results).toEqual([true, true, true, false]);
    expect((await hitRateLimit(testDb, "app:test:1.2.3.4", limit, t0 + 61_000)).allowed).toBe(true);
    expect((await hitRateLimit(testDb, "app:test:5.6.7.8", limit, t0)).allowed).toBe(true);
  });

  it("counts concurrent hits atomically", async () => {
    const limit = { max: 5, windowSeconds: 60 };
    const res = await Promise.all(
      Array.from({ length: 10 }, () => hitRateLimit(testDb, "app:race", limit)),
    );
    expect(res.filter((r) => r.allowed)).toHaveLength(5);
  });
});

describe("security headers", () => {
  it("locks the CSP down and allows only the known third parties", () => {
    const csp = buildCsp({
      mediaUrl: "https://media.rerabody.example/x",
      r2AccountId: "abc123",
      dev: false,
      https: true,
    });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("img-src 'self' data: blob: https://media.rerabody.example");
    expect(csp).toContain("connect-src 'self' https://abc123.r2.cloudflarestorage.com");
    expect(csp).toContain("https://embed.tawk.to");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("adds HSTS only on https", () => {
    const keys = (https: boolean) => securityHeaders({ dev: false, https }).map((h) => h.key);
    expect(keys(true)).toContain("Strict-Transport-Security");
    expect(keys(false)).not.toContain("Strict-Transport-Security");
  });
});
