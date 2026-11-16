"use server";

import { z } from "zod";

import { emailField } from "@/lib/schemas/auth";
import { addressSchema } from "@/lib/schemas/checkout";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import {
  deleteAddress,
  findOrderByNumberAndEmail,
  saveAddress,
  updateProfile,
} from "@/server/services/account";
import { signValue } from "@/server/signed-links";

import { publicAction, userAction } from "./safe-action";

export const saveAddressAction = userAction(
  addressSchema.extend({ id: z.string().optional(), isDefault: z.boolean() }),
  async (input, user) => {
    const a = await saveAddress(db, user.id, input);
    return { id: a.id };
  },
);

export const deleteAddressAction = userAction(z.object({ id: z.string() }), async (input, user) => {
  await deleteAddress(db, user.id, input.id);
});

export const updateProfileAction = userAction(
  z.object({
    name: z.string().trim().min(1, "Enter your name").max(100),
    phone: z
      .string()
      .trim()
      .max(30)
      .transform((v) => v || null),
  }),
  async (input, user) => {
    await updateProfile(db, user.id, input);
  },
);

/** S24: order number plus email gives a signed tracking link. Same message either way for unknown pairs. */
export const findOrderAction = publicAction(
  z.object({ number: z.string().trim().min(3).max(30), email: emailField }),
  async (input) => {
    const id = await findOrderByNumberAndEmail(db, input.number, input.email);
    if (!id) throw new UserError("We could not find an order with that number and email.");
    return {
      url: `/orders/track?order=${id}&sig=${encodeURIComponent(signValue("order", id, null))}`,
    };
  },
);
