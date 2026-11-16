"use server";

import { z } from "zod";

import { env } from "@/env";
import { minorUnitDigits } from "@/lib/money";
import { db } from "@/server/db";
import { customersCsv, ordersCsv } from "@/server/services/reports";

import { adminAction } from "./safe-action";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** CSV export. Returns the file contents; the browser saves it. */
export const exportCsvAction = adminAction(
  "reports.read",
  z.object({ kind: z.enum(["orders", "customers"]), from: day, to: day }),
  async (input) => {
    const digits = minorUnitDigits(env.STORE_CURRENCY);
    const range = {
      from: new Date(`${input.from}T00:00:00Z`),
      to: new Date(new Date(`${input.to}T00:00:00Z`).getTime() + 86400_000),
    };
    const csv =
      input.kind === "orders" ? await ordersCsv(db, range, digits) : await customersCsv(db, digits);
    return { filename: `rera-${input.kind}-${input.from}-to-${input.to}.csv`, csv };
  },
);
