import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { UserError, isUniqueConstraintError } from "@/server/errors";

import { audit } from "./audit";

type Db = PrismaClient | Prisma.TransactionClient;

/** Recomputes a product's average rating and count from its APPROVED reviews (rule 9). */
export async function recalcProductRating(db: Db, productId: string) {
  const agg = await db.review.aggregate({
    where: { productId, status: "APPROVED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await db.product.update({
    where: { id: productId },
    data: {
      ratingAverage: Math.round((agg._avg.rating ?? 0) * 100) / 100,
      ratingCount: agg._count._all,
    },
  });
}

/**
 * Checks rule 9 for one order item: the user must be its buyer, the order must
 * be DELIVERED and the item must not already have a review. A guest buyer is
 * matched by the verified email of the account they sign in with.
 */
export async function reviewEligibility(
  db: Db,
  input: { orderItemId: string; user: { id: string; email: string; emailVerified: boolean } },
) {
  const item = await db.orderItem.findUnique({
    where: { id: input.orderItemId },
    include: {
      order: { select: { status: true, userId: true, email: true } },
      review: { select: { id: true } },
      product: { select: { id: true, name: true, slug: true, status: true } },
    },
  });
  if (!item) return { ok: false as const, reason: "We could not find that item." };
  const isBuyer =
    item.order.userId === input.user.id ||
    (item.order.userId === null &&
      input.user.emailVerified &&
      item.order.email.toLowerCase() === input.user.email.toLowerCase());
  if (!isBuyer)
    return {
      ok: false as const,
      reason:
        "Only the person who bought this item can review it. Sign in with the account or email you ordered with.",
    };
  if (item.order.status !== "DELIVERED")
    return { ok: false as const, reason: "You can review this item once it has been delivered." };
  if (item.review)
    return { ok: false as const, reason: "You have already reviewed this item. Thank you!" };
  if (!item.product)
    return { ok: false as const, reason: "This product is no longer available to review." };
  return { ok: true as const, item, product: item.product };
}

export async function submitReview(
  prisma: PrismaClient,
  input: {
    orderItemId: string;
    user: { id: string; email: string; emailVerified: boolean };
    rating: number;
    title: string | null;
    body: string;
  },
) {
  const check = await reviewEligibility(prisma, input);
  if (!check.ok) throw new UserError(check.reason);
  try {
    return await prisma.review.create({
      data: {
        productId: check.product.id,
        orderItemId: input.orderItemId,
        userId: input.user.id,
        rating: input.rating,
        title: input.title,
        body: input.body,
        status: "PENDING",
      },
    });
  } catch (error) {
    // Unique on orderItemId: a second submission races the first.
    if (isUniqueConstraintError(error))
      throw new UserError("You have already reviewed this item. Thank you!");
    throw error;
  }
}

export type ModerationAction =
  "approve" | "reject" | "unpublish" | "delete" | "feature" | "unfeature";

/** A14 moderation. Ratings are recalculated whenever an approved review changes state (rule 9). */
export async function moderateReview(
  prisma: PrismaClient,
  input: { reviewId: string; action: ModerationAction; reason?: string | null; actorId: string },
) {
  return prisma.$transaction(async (tx) => {
    const review = await tx.review.findUnique({ where: { id: input.reviewId } });
    if (!review) throw new UserError("This review no longer exists.");
    switch (input.action) {
      case "approve":
        await tx.review.update({
          where: { id: review.id },
          data: { status: "APPROVED", rejectionReason: null },
        });
        break;
      case "reject":
        await tx.review.update({
          where: { id: review.id },
          data: { status: "REJECTED", rejectionReason: input.reason ?? null, isFeatured: false },
        });
        break;
      case "unpublish":
        if (review.status !== "APPROVED")
          throw new UserError("Only published reviews can be unpublished.");
        await tx.review.update({
          where: { id: review.id },
          data: { status: "PENDING", isFeatured: false },
        });
        break;
      case "delete":
        await tx.review.delete({ where: { id: review.id } });
        break;
      case "feature":
      case "unfeature":
        if (input.action === "feature" && review.status !== "APPROVED")
          throw new UserError("Approve the review before featuring it.");
        await tx.review.update({
          where: { id: review.id },
          data: { isFeatured: input.action === "feature" },
        });
        break;
    }
    if (input.action !== "feature" && input.action !== "unfeature")
      await recalcProductRating(tx, review.productId);
    await audit(tx, {
      actorId: input.actorId,
      action: `review.${input.action}`,
      targetType: "Review",
      targetId: review.id,
      before: review,
      after: { reason: input.reason ?? null },
    });
    return { productId: review.productId };
  });
}

/** Used before an account is deleted: removes the user's reviews and fixes the ratings they affected. */
export async function removeReviewsForUser(prisma: PrismaClient, userId: string) {
  const reviews = await prisma.review.findMany({ where: { userId }, select: { productId: true } });
  if (!reviews.length) return [];
  await prisma.review.deleteMany({ where: { userId } });
  const productIds = [...new Set(reviews.map((r) => r.productId))];
  for (const id of productIds) await recalcProductRating(prisma, id);
  return productIds;
}

export async function listProductReviews(prisma: PrismaClient, productId: string, take = 20) {
  return prisma.review.findMany({
    where: { productId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });
}
