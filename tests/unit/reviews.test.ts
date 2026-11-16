import { beforeEach, describe, expect, it } from "vitest";

import { couponSchema } from "@/lib/schemas/coupon";
import { saveCoupon } from "@/server/services/coupon-admin";
import { listCustomers } from "@/server/services/customers";
import {
  listProductReviews,
  moderateReview,
  removeReviewsForUser,
  submitReview,
} from "@/server/services/reviews";
import { createTicket, replyToTicket } from "@/server/services/support";

import { resetDb, testDb } from "../helpers/db";
import { createProduct, createRole, createUser, uid } from "../helpers/factories";

async function orderFor(
  opts: { userId: string | null; email: string; status: "DELIVERED" | "SHIPPED" },
  product: Awaited<ReturnType<typeof createProduct>>,
) {
  const order = await testDb.order.create({
    data: {
      number: uid("RB-"),
      userId: opts.userId,
      email: opts.email,
      status: opts.status,
      subtotal: 1000,
      total: 1000,
      currency: "GBP",
      shippingAddress: {},
      shippingMethod: {},
      items: {
        create: {
          productId: product.id,
          variantId: product.variants[0].id,
          productName: product.name,
          variantLabel: "Default",
          sku: product.variants[0].sku,
          unitPrice: 1000,
          quantity: 1,
          lineTotal: 1000,
        },
      },
    },
    include: { items: true },
  });
  return order.items[0];
}

describe("reviews (rule 9)", () => {
  let product: Awaited<ReturnType<typeof createProduct>>;
  let buyer: Awaited<ReturnType<typeof createUser>>;
  let moderatorId: string;
  const asUser = (u: { id: string; email: string; emailVerified: boolean }) => ({
    id: u.id,
    email: u.email,
    emailVerified: u.emailVerified,
  });

  beforeEach(async () => {
    await resetDb();
    product = await createProduct();
    buyer = await createUser({ email: "buyer@example.test" });
    moderatorId = (await createUser({ roleId: (await createRole("Manager")).id })).id;
  });

  it("a buyer of a delivered item can review it once; it stays hidden until approved", async () => {
    const item = await orderFor(
      { userId: buyer.id, email: buyer.email, status: "DELIVERED" },
      product,
    );
    const review = await submitReview(testDb, {
      orderItemId: item.id,
      user: asUser(buyer),
      rating: 4,
      title: "Lovely",
      body: "Rich and soft on the skin.",
    });
    expect(review.status).toBe("PENDING");
    expect(await listProductReviews(testDb, product.id)).toHaveLength(0);
    expect(
      (await testDb.product.findUniqueOrThrow({ where: { id: product.id } })).ratingCount,
    ).toBe(0);

    await expect(
      submitReview(testDb, {
        orderItemId: item.id,
        user: asUser(buyer),
        rating: 5,
        title: null,
        body: "Second attempt here.",
      }),
    ).rejects.toThrow(/already reviewed/);

    await moderateReview(testDb, { reviewId: review.id, action: "approve", actorId: moderatorId });
    expect(await listProductReviews(testDb, product.id)).toHaveLength(1);
    expect(await testDb.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      ratingAverage: 4,
      ratingCount: 1,
    });
  });

  it("refuses someone who did not buy the item, even calling the service directly", async () => {
    const item = await orderFor(
      { userId: buyer.id, email: buyer.email, status: "DELIVERED" },
      product,
    );
    const stranger = await createUser({ email: "stranger@example.test" });
    await expect(
      submitReview(testDb, {
        orderItemId: item.id,
        user: asUser(stranger),
        rating: 1,
        title: null,
        body: "Never bought this but...",
      }),
    ).rejects.toThrow(/Only the person who bought/);
    expect(await testDb.review.count()).toBe(0);
  });

  it("refuses items whose order is not delivered yet", async () => {
    const item = await orderFor(
      { userId: buyer.id, email: buyer.email, status: "SHIPPED" },
      product,
    );
    await expect(
      submitReview(testDb, {
        orderItemId: item.id,
        user: asUser(buyer),
        rating: 5,
        title: null,
        body: "Arrived? Not yet.",
      }),
    ).rejects.toThrow(/once it has been delivered/);
  });

  it("matches a guest order by verified email only", async () => {
    const item = await orderFor(
      { userId: null, email: "Guest@Example.test", status: "DELIVERED" },
      product,
    );
    const unverified = await testDb.user.create({
      data: { name: "G", email: "guest@example.test", emailVerified: false },
    });
    await expect(
      submitReview(testDb, {
        orderItemId: item.id,
        user: asUser(unverified),
        rating: 5,
        title: null,
        body: "Lovely product, thanks.",
      }),
    ).rejects.toThrow(/Only the person/);
    await testDb.user.update({ where: { id: unverified.id }, data: { emailVerified: true } });
    await expect(
      submitReview(testDb, {
        orderItemId: item.id,
        user: { ...asUser(unverified), emailVerified: true },
        rating: 5,
        title: null,
        body: "Lovely product, thanks.",
      }),
    ).resolves.toMatchObject({ status: "PENDING" });
  });

  it("recalculates the rating on approve, unpublish and delete", async () => {
    const other = await createUser();
    const a = await submitReview(testDb, {
      orderItemId: (
        await orderFor({ userId: buyer.id, email: buyer.email, status: "DELIVERED" }, product)
      ).id,
      user: asUser(buyer),
      rating: 5,
      title: null,
      body: "Five stars from me.",
    });
    const b = await submitReview(testDb, {
      orderItemId: (
        await orderFor({ userId: other.id, email: other.email, status: "DELIVERED" }, product)
      ).id,
      user: asUser(other),
      rating: 2,
      title: null,
      body: "Not for me sadly.",
    });
    await moderateReview(testDb, { reviewId: a.id, action: "approve", actorId: moderatorId });
    await moderateReview(testDb, { reviewId: b.id, action: "approve", actorId: moderatorId });
    expect(await testDb.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      ratingAverage: 3.5,
      ratingCount: 2,
    });
    await moderateReview(testDb, { reviewId: b.id, action: "unpublish", actorId: moderatorId });
    expect(await testDb.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      ratingAverage: 5,
      ratingCount: 1,
    });
    await moderateReview(testDb, { reviewId: a.id, action: "delete", actorId: moderatorId });
    expect(await testDb.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      ratingAverage: 0,
      ratingCount: 0,
    });
    await expect(
      moderateReview(testDb, { reviewId: b.id, action: "feature", actorId: moderatorId }),
    ).rejects.toThrow(/Approve the review/);
  });

  it("removing a deleted account's reviews fixes the rating", async () => {
    const r = await submitReview(testDb, {
      orderItemId: (
        await orderFor({ userId: buyer.id, email: buyer.email, status: "DELIVERED" }, product)
      ).id,
      user: asUser(buyer),
      rating: 3,
      title: null,
      body: "It was fine overall.",
    });
    await moderateReview(testDb, { reviewId: r.id, action: "approve", actorId: moderatorId });
    expect(await removeReviewsForUser(testDb, buyer.id)).toEqual([product.id]);
    expect(
      (await testDb.product.findUniqueOrThrow({ where: { id: product.id } })).ratingCount,
    ).toBe(0);
  });
});

describe("coupons, support and customers admin", () => {
  let actorId: string;
  beforeEach(async () => {
    await resetDb();
    actorId = (await createUser({ roleId: (await createRole("Owner")).id })).id;
  });

  it("validates coupons and keeps codes unique and uppercase", async () => {
    const base = {
      type: "PERCENT" as const,
      value: 10,
      startsAt: null,
      endsAt: null,
      minSpend: null,
      usageLimit: null,
      perCustomerLimit: null,
      isActive: true,
      showOnOffers: false,
      restrictedProductIds: [],
      restrictedCategoryIds: [],
    };
    expect(couponSchema.safeParse({ ...base, code: "SAVE", value: 150 }).success).toBe(false);
    expect(
      couponSchema.safeParse({
        ...base,
        code: "SAVE",
        startsAt: "2026-02-01T00:00",
        endsAt: "2026-01-01T00:00",
      }).success,
    ).toBe(false);
    const created = await saveCoupon(
      testDb,
      couponSchema.parse({ ...base, code: "spring-10" }),
      actorId,
    );
    expect(created.code).toBe("SPRING-10");
    await expect(
      saveCoupon(testDb, couponSchema.parse({ ...base, code: "SPRING-10" }), actorId),
    ).rejects.toThrow(/already uses/);
  });

  it("numbers tickets and records replies", async () => {
    const t1 = await createTicket(testDb, {
      name: "Ada",
      email: "Ada@Example.test",
      orderNumber: null,
      subject: "Sizes",
      message: "Which size should I pick?",
    });
    const t2 = await createTicket(testDb, {
      name: "Bo",
      email: "bo@example.test",
      orderNumber: "rb-10001",
      subject: "Where",
      message: "Where is my parcel?",
    });
    expect(t1.number).toMatch(/^T-\d+$/);
    expect(Number(t2.number.slice(2))).toBe(Number(t1.number.slice(2)) + 1);
    expect(t2.orderNumber).toBe("RB-10001");
    await replyToTicket(testDb, { ticketId: t1.id, body: "A medium.", actorId, close: true });
    const after = await testDb.supportTicket.findUniqueOrThrow({
      where: { id: t1.id },
      include: { messages: true },
    });
    expect(after.status).toBe("CLOSED");
    expect(after.messages.map((m) => m.authorId)).toEqual([null, actorId]);
  });

  it("totals customer spend from paid orders only", async () => {
    const customer = await createUser({ name: "Spender" });
    for (const [status, total] of [
      ["PAID", 1000],
      ["DELIVERED", 2500],
      ["CANCELLED", 9999],
      ["PENDING_PAYMENT", 7777],
    ] as const) {
      await testDb.order.create({
        data: {
          number: uid("RB-"),
          userId: customer.id,
          email: customer.email,
          status,
          subtotal: total,
          total,
          currency: "GBP",
          shippingAddress: {},
          shippingMethod: {},
        },
      });
    }
    const { items } = await listCustomers(testDb, { q: "Spender" });
    expect(items[0]).toMatchObject({ orders: 2, spend: 3500 });
  });
});
