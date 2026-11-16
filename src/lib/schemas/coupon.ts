import { z } from "zod";

export const couponSchema = z
  .object({
    id: z.string().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "Use at least 3 characters")
      .max(30)
      .regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, dashes or underscores"),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.number().int().positive("Enter a value above zero"),
    startsAt: z.string().nullable(),
    endsAt: z.string().nullable(),
    minSpend: z.number().int().min(0).nullable(),
    usageLimit: z.number().int().min(1).nullable(),
    perCustomerLimit: z.number().int().min(1).nullable(),
    isActive: z.boolean(),
    showOnOffers: z.boolean(),
    restrictedProductIds: z.array(z.string()).max(200),
    restrictedCategoryIds: z.array(z.string()).max(50),
  })
  .refine((c) => c.type !== "PERCENT" || c.value <= 100, {
    path: ["value"],
    message: "A percentage cannot be more than 100",
  })
  .refine((c) => !c.startsAt || !c.endsAt || new Date(c.endsAt) > new Date(c.startsAt), {
    path: ["endsAt"],
    message: "The end must be after the start",
  });
export type CouponInput = z.input<typeof couponSchema>;
