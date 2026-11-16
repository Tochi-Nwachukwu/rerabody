"use server";

import { z } from "zod";

import { TAGS, expireTags } from "@/server/cache-tags";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/rate-limit";
import { UserError } from "@/server/errors";
import { moderateReview, submitReview } from "@/server/services/reviews";

import { adminAction, userAction } from "./safe-action";

/** S23. Rule 9 is enforced in the service, so calling this directly as a non-buyer fails. */
export const submitReviewAction = userAction(
  z.object({
    orderItemId: z.string(),
    rating: z.number().int().min(1, "Choose a star rating").max(5),
    title: z
      .string()
      .trim()
      .max(120)
      .transform((v) => v || null)
      .nullable(),
    body: z.string().trim().min(10, "Write at least a sentence (10 characters)").max(3000),
  }),
  async (input, user) => {
    await enforceRateLimit("review", user.id);
    const full = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, emailVerified: true },
    });
    if (!full) throw new UserError("Please sign in again.");
    await submitReview(db, { ...input, user: full });
  },
);

export const moderateReviewAction = adminAction(
  "reviews.moderate",
  z.object({
    reviewId: z.string(),
    action: z.enum(["approve", "reject", "unpublish", "delete", "feature", "unfeature"]),
    reason: z.string().trim().max(300).nullable().optional(),
  }),
  async (input, staff) => {
    const { productId } = await moderateReview(db, { ...input, actorId: staff.userId });
    expireTags(
      TAGS.reviews(productId),
      TAGS.product(productId),
      TAGS.products,
      TAGS.featuredReviews,
    );
  },
);
