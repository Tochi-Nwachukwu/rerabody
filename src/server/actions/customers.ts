"use server";

import { z } from "zod";

import { db } from "@/server/db";
import { updateCustomer } from "@/server/services/customers";

import { adminAction } from "./safe-action";

export const updateCustomerAction = adminAction(
  "customers.update",
  z.object({
    id: z.string(),
    name: z.string().trim().min(1, "Enter a name").max(100),
    phone: z
      .string()
      .trim()
      .max(30)
      .transform((v) => v || null)
      .nullable(),
    status: z.enum(["ACTIVE", "DEACTIVATED"]),
  }),
  async (input, staff) => updateCustomer(db, { ...input, actorId: staff.userId }),
);
