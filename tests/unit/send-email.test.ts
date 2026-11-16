import { beforeEach, describe, expect, it } from "vitest";

import { sendEmailWith } from "@/server/email/send";
import { createMemoryTransport } from "@/server/email/transport";

import { resetDb, testDb } from "../helpers/db";

function deps() {
  const transport = createMemoryTransport();
  return {
    transport,
    deps: {
      prisma: testDb,
      transport,
      from: { orders: "orders@example.test", marketing: "hello@example.test" },
    },
  };
}

describe("sendEmail", () => {
  beforeEach(resetDb);

  it("logs and sends once per dedupe key", async () => {
    const { transport, deps: d } = deps();
    const input = {
      template: "welcome" as const,
      to: "Ada@Example.test",
      dedupeKey: "welcome:u1",
      props: { name: "Ada" },
    };
    const first = await sendEmailWith(d, input);
    const second = await sendEmailWith(d, input);
    expect(first.status).toBe("sent");
    expect(second.status).toBe("duplicate");
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].to).toBe("ada@example.test");
    expect(transport.sent[0].from).toBe("orders@example.test");
    const logs = await testDb.emailLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("SENT");
  });

  it("sends once under concurrent calls with the same key", async () => {
    const { transport, deps: d } = deps();
    const input = {
      template: "welcome" as const,
      to: "a@example.test",
      dedupeKey: "welcome:race",
      props: { name: "A" },
    };
    const results = await Promise.all([
      sendEmailWith(d, input),
      sendEmailWith(d, input),
      sendEmailWith(d, input),
    ]);
    expect(results.filter((r) => r.status === "sent")).toHaveLength(1);
    expect(transport.sent).toHaveLength(1);
  });

  it("retries a key whose earlier send failed", async () => {
    const { transport, deps: d } = deps();
    const input = {
      template: "welcome" as const,
      to: "a@example.test",
      dedupeKey: "welcome:retry",
      props: { name: "A" },
    };
    transport.failNextSend();
    expect((await sendEmailWith(d, input)).status).toBe("failed");
    expect((await testDb.emailLog.findFirstOrThrow()).status).toBe("FAILED");
    expect((await sendEmailWith(d, input)).status).toBe("sent");
    expect(transport.sent).toHaveLength(1);
    expect(await testDb.emailLog.count()).toBe(1);
  });

  it("always sends templates without a dedupe key", async () => {
    const { transport, deps: d } = deps();
    const input = {
      template: "password-reset" as const,
      to: "a@example.test",
      props: { name: "A", url: "http://x/reset" },
    };
    await sendEmailWith(d, input);
    await sendEmailWith(d, input);
    expect(transport.sent).toHaveLength(2);
    expect(transport.sent[0].html).toContain("http://x/reset");
    expect(transport.sent[0].text).toContain("Choose a new password http://x/reset");
  });
});
