import { z } from "zod";

import { emailField } from "./auth";

export const addressSchema = z.object({
  fullName: z.string().trim().min(1, "Enter the recipient's name").max(100),
  phone: z.string().trim().min(5, "Enter a phone number for the courier").max(30),
  line1: z.string().trim().min(1, "Enter the first line of the address").max(120),
  line2: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || undefined),
  city: z.string().trim().min(1, "Enter a town or city").max(80),
  state: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || undefined),
  postalCode: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => v || undefined),
  country: z.string().trim().min(2, "Enter a country").max(60),
});
export type AddressInput = z.input<typeof addressSchema>;
export type AddressData = z.output<typeof addressSchema>;

export const checkoutSchema = z.object({
  email: emailField,
  address: addressSchema,
  shippingMethodId: z.string().min(1, "Choose a delivery option"),
  saveAddress: z.boolean().default(false),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;

export const cartQuantitySchema = z.object({
  itemId: z.string(),
  quantity: z.number().int().min(0).max(99),
});
export const addToCartSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int().min(1).max(20),
});
export const couponCodeSchema = z.object({
  code: z.string().trim().min(1, "Enter a code").max(40),
});
