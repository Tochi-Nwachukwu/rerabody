import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { UserError } from "@/server/errors";

/** Rule 4. Any move not listed here throws. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "REFUNDED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "REFUNDED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export class InvalidTransitionError extends UserError {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(
      `An order cannot move from ${from.replaceAll("_", " ").toLowerCase()} to ${to.replaceAll("_", " ").toLowerCase()}.`,
    );
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/**
 * Moves an order to a new status and writes the OrderStatusEvent in the same
 * transaction (rule 5). The update is conditional on the status read, so two
 * concurrent moves cannot both apply; the loser gets an error.
 */
export async function transitionOrder(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    to: OrderStatus;
    actorId: string | null;
    note?: string | null;
    data?: Omit<Prisma.OrderUpdateManyMutationInput, "status">;
  },
): Promise<{ from: OrderStatus; to: OrderStatus }> {
  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    select: { status: true },
  });
  if (!order) throw new UserError("This order no longer exists.");
  assertTransition(order.status, input.to);
  const updated = await tx.order.updateMany({
    where: { id: input.orderId, status: order.status },
    data: { ...input.data, status: input.to },
  });
  if (updated.count === 0)
    throw new UserError("This order was changed by someone else. Reload and try again.");
  await tx.orderStatusEvent.create({
    data: {
      orderId: input.orderId,
      fromStatus: order.status,
      toStatus: input.to,
      note: input.note ?? null,
      actorId: input.actorId,
    },
  });
  return { from: order.status, to: input.to };
}
