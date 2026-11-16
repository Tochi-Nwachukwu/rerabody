import type { PrismaClient } from "@/generated/prisma/client";

/** Active, published variants at or under their low stock threshold. */
export function findLowStockVariants(prisma: PrismaClient) {
  return prisma.productVariant.findMany({
    where: {
      isActive: true,
      product: { status: "PUBLISHED" },
      stock: { lte: prisma.productVariant.fields.lowStockThreshold },
    },
    orderBy: { stock: "asc" },
    select: {
      id: true,
      sku: true,
      stock: true,
      lowStockThreshold: true,
      optionValues: true,
      product: { select: { name: true } },
    },
  });
}
