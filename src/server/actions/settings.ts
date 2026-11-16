"use server";

import { z } from "zod";

import { settingSchemas } from "@/lib/settings";
import { TAGS, expireTags } from "@/server/cache-tags";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { UserError } from "@/server/errors";
import { getSiteSettings } from "@/server/queries/settings";
import { deleteShippingMethod, saveSetting, saveShippingMethod } from "@/server/services/settings";

import { adminAction } from "./safe-action";

const P = "settings.manage";
const keys = Object.keys(settingSchemas) as [
  keyof typeof settingSchemas,
  ...(keyof typeof settingSchemas)[],
];

export const saveSettingAction = adminAction(
  P,
  z.object({ key: z.enum(keys), value: z.unknown() }),
  async (input, staff) => {
    await saveSetting(db, input.key, input.value, staff.userId);
    // Store details, footer and SEO appear on every page.
    expireTags(TAGS.settings, TAGS.home);
  },
);

export const saveShippingMethodAction = adminAction(
  P,
  z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Enter a name").max(80),
    price: z.number().int().min(0).max(10_000_000),
    region: z
      .string()
      .trim()
      .max(80)
      .transform((v) => v || null)
      .nullable(),
    estimate: z
      .string()
      .trim()
      .max(80)
      .transform((v) => v || null)
      .nullable(),
    isActive: z.boolean(),
  }),
  async (input, staff) => {
    const m = await saveShippingMethod(db, { ...input, actorId: staff.userId });
    expireTags(TAGS.shipping);
    return { id: m.id };
  },
);

export const deleteShippingMethodAction = adminAction(
  P,
  z.object({ id: z.string() }),
  async (input, staff) => {
    await deleteShippingMethod(db, input.id, staff.userId);
    expireTags(TAGS.shipping);
  },
);

/** A28 test email: sends to the admin alert address, or to the signed-in staff member. */
export const sendTestEmailAction = adminAction(P, z.object({}), async (_input, staff) => {
  const settings = await getSiteSettings();
  const to = settings.notifications.adminAlertEmail || staff.email;
  const res = await sendEmail({ template: "settings-test", to, props: { sentBy: staff.name } });
  if (res.status === "failed") throw new UserError(`Sending failed: ${res.error}`);
  return { to };
});
