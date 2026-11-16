import { describe, expect, it } from "vitest";

import type { OrderStatus } from "@/generated/prisma/client";
import {
  ORDER_TRANSITIONS,
  InvalidTransitionError,
  assertTransition,
  canTransition,
} from "@/server/services/order-status";

const ALL: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

// Rule 4, written out independently of the implementation.
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "REFUNDED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

describe("order state machine", () => {
  for (const from of ALL) {
    for (const to of ALL) {
      const allowed = ALLOWED[from].includes(to);
      it(`${allowed ? "allows" : "refuses"} ${from} -> ${to}`, () => {
        expect(canTransition(from, to)).toBe(allowed);
        if (allowed) expect(() => assertTransition(from, to)).not.toThrow();
        else expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError);
      });
    }
  }

  it("matches the table exactly", () => {
    expect(ORDER_TRANSITIONS).toEqual(ALLOWED);
  });
});
