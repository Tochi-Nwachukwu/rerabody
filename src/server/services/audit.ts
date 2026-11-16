import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type AuditEntry = {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
};

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Records one admin action. Call it from every admin mutation, inside its transaction when there is one. */
export async function audit(db: Db, entry: AuditEntry) {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      before: toJson(entry.before),
      after: toJson(entry.after),
    },
  });
}
