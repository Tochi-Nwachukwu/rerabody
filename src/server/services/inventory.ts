import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { UserError } from "@/server/errors";

import { audit } from "./audit";

export type AdjustStockInput = {
  variantId: string;
  mode: "delta" | "set";
  amount: number;
  reason: "RESTOCK" | "DAMAGE" | "CORRECTION";
  note: string | null;
  actorId: string;
};

/**
 * Changes a variant's stock and records the movement. The update is
 * conditional, so stock never goes below zero and a "set" never overwrites a
 * change made by someone else in the meantime (for example a sale).
 */
export async function adjustStock(prisma: PrismaClient, input: AdjustStockInput) {
  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({
      where: { id: input.variantId },
      select: { id: true, stock: true, sku: true, productId: true },
    });
    if (!variant) throw new UserError("This variant no longer exists.");

    let delta: number;
    let where: Prisma.ProductVariantWhereInput;
    if (input.mode === "set") {
      if (input.amount < 0) throw new UserError("Stock cannot be negative.");
      delta = input.amount - variant.stock;
      where = { id: variant.id, stock: variant.stock };
    } else {
      delta = input.amount;
      where = { id: variant.id, stock: { gte: Math.max(0, -delta) } };
    }
    if (delta === 0) throw new UserError("The new stock is the same as the current stock.");
    if (input.reason === "RESTOCK" && delta < 0)
      throw new UserError("A restock must add stock. Use damage or correction to remove it.");
    if (input.reason === "DAMAGE" && delta > 0)
      throw new UserError("Damage can only remove stock.");

    const updated = await tx.productVariant.updateMany({
      where,
      data: { stock: { increment: delta } },
    });
    if (updated.count === 0) {
      throw new UserError(
        input.mode === "set"
          ? "Stock changed while you were editing. Reload and try again."
          : `Only ${variant.stock} in stock, so ${Math.abs(delta)} cannot be removed.`,
      );
    }
    const movement = await tx.inventoryMovement.create({
      data: {
        variantId: variant.id,
        delta,
        reason: input.reason,
        note: input.note,
        actorId: input.actorId,
      },
    });
    const after = await tx.productVariant.findUniqueOrThrow({
      where: { id: variant.id },
      select: { stock: true },
    });
    await audit(tx, {
      actorId: input.actorId,
      action: "inventory.adjust",
      targetType: "ProductVariant",
      targetId: variant.id,
      before: { stock: variant.stock },
      after: { stock: after.stock, delta, reason: input.reason, note: input.note },
    });
    return { stock: after.stock, delta, movementId: movement.id, productId: variant.productId };
  });
}

export type InventoryFilter = "all" | "low" | "out";

export async function listInventory(
  prisma: PrismaClient,
  input: { q?: string; filter?: InventoryFilter; categoryId?: string; page?: number },
) {
  const pageSize = 50;
  const page = Math.max(1, input.page ?? 1);
  const where: Prisma.ProductVariantWhereInput = {
    product: {
      status: { not: "ARCHIVED" },
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    },
    ...(input.filter === "out" ? { stock: 0 } : {}),
    ...(input.filter === "low"
      ? { stock: { lte: prisma.productVariant.fields.lowStockThreshold } }
      : {}),
    ...(input.q
      ? {
          OR: [
            { sku: { contains: input.q, mode: "insensitive" } },
            { product: { name: { contains: input.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      orderBy: [{ stock: "asc" }, { sku: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        product: {
          select: { id: true, name: true, status: true, category: { select: { name: true } } },
        },
      },
    }),
    prisma.productVariant.count({ where }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listMovements(prisma: PrismaClient, variantId: string, take = 50) {
  return prisma.inventoryMovement.findMany({
    where: { variantId },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { name: true } }, order: { select: { id: true, number: true } } },
  });
}
