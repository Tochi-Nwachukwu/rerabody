import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { type SettingKey, settingSchemas } from "@/lib/settings";
import { UserError } from "@/server/errors";

import { audit } from "./audit";

export async function saveSetting(
  prisma: PrismaClient,
  key: SettingKey,
  value: unknown,
  actorId: string,
) {
  const parsed = settingSchemas[key].safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new UserError(`${issue.path.join(" ") || key}: ${issue.message}`);
  }
  const before = await prisma.siteSetting.findUnique({ where: { key } });
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value: parsed.data as Prisma.InputJsonValue },
    create: { key, value: parsed.data as Prisma.InputJsonValue },
  });
  await audit(prisma, {
    actorId,
    action: "settings.update",
    targetType: "SiteSetting",
    targetId: key,
    before: before?.value,
    after: parsed.data,
  });
  return parsed.data;
}

export async function saveShippingMethod(
  prisma: PrismaClient,
  input: {
    id?: string;
    name: string;
    price: number;
    region: string | null;
    estimate: string | null;
    isActive: boolean;
    actorId: string;
  },
) {
  const before = input.id
    ? await prisma.shippingMethod.findUnique({ where: { id: input.id } })
    : null;
  const data = {
    name: input.name,
    price: input.price,
    region: input.region,
    estimate: input.estimate,
    isActive: input.isActive,
  };
  const after = before
    ? await prisma.shippingMethod.update({ where: { id: before.id }, data })
    : await prisma.shippingMethod.create({ data });
  await audit(prisma, {
    actorId: input.actorId,
    action: before ? "shipping.update" : "shipping.create",
    targetType: "ShippingMethod",
    targetId: after.id,
    before,
    after,
  });
  return after;
}

export async function deleteShippingMethod(prisma: PrismaClient, id: string, actorId: string) {
  const before = await prisma.shippingMethod.delete({ where: { id } });
  await audit(prisma, {
    actorId,
    action: "shipping.delete",
    targetType: "ShippingMethod",
    targetId: id,
    before,
  });
}
