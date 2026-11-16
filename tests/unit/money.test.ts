import { describe, expect, it } from "vitest";

import { formatMoney } from "@/lib/money";

describe("formatMoney", () => {
  it("formats minor units in a two-decimal currency", () => {
    expect(formatMoney(1999, "USD")).toBe("$19.99");
    expect(formatMoney(123456, "USD")).toBe("$1,234.56");
    expect(formatMoney(1999, "GBP")).toBe("£19.99");
    expect(formatMoney(0, "GBP")).toBe("£0.00");
  });

  it("respects zero-decimal currencies", () => {
    expect(formatMoney(500, "JPY", "en-GB")).toBe("JP¥500");
  });

  it("rejects non-integer amounts", () => {
    expect(() => formatMoney(19.99, "GBP")).toThrow();
  });
});
