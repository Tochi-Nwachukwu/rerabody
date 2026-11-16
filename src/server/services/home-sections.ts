import { type HomeSection, Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  SECTION_DEFAULTS,
  SECTION_LABELS,
  type SectionType,
  parseSection,
} from "@/lib/home-sections";
import { UserError } from "@/server/errors";

import { audit } from "./audit";

/**
 * Homepage sections have a published state (data, position, isVisible) and a
 * draft state (draftData, draftPosition, draftIsVisible, isDraftDeleted).
 * The editor only changes the draft; publish copies draft to published.
 */
export type DraftSection = {
  id: string;
  type: SectionType;
  position: number;
  isVisible: boolean;
  data: unknown;
  isNew: boolean;
  changed: boolean;
};

export function effective(row: HomeSection): DraftSection {
  return {
    id: row.id,
    type: row.type as SectionType,
    position: row.draftPosition ?? row.position,
    isVisible: row.draftIsVisible ?? row.isVisible,
    data: row.draftData ?? row.data,
    isNew: row.data === null,
    changed:
      row.draftData !== null ||
      row.draftPosition !== null ||
      row.draftIsVisible !== null ||
      row.isDraftDeleted,
  };
}

export async function listDraftSections(prisma: PrismaClient): Promise<DraftSection[]> {
  const rows = await prisma.homeSection.findMany({ where: { isDraftDeleted: false } });
  return rows.map(effective).sort((a, b) => a.position - b.position);
}

export async function hasUnpublishedChanges(prisma: PrismaClient) {
  const count = await prisma.homeSection.count({
    where: {
      OR: [
        { draftData: { not: Prisma.DbNull } },
        { draftPosition: { not: null } },
        { draftIsVisible: { not: null } },
        { isDraftDeleted: true },
      ],
    },
  });
  return count > 0;
}

async function nextPosition(db: Prisma.TransactionClient | PrismaClient) {
  const rows = await db.homeSection.findMany({ select: { position: true, draftPosition: true } });
  return rows.reduce((m, r) => Math.max(m, r.draftPosition ?? r.position), -1) + 1;
}

export async function addSection(prisma: PrismaClient, type: SectionType, actorId: string) {
  const position = await nextPosition(prisma);
  const row = await prisma.homeSection.create({
    data: {
      type,
      position,
      isVisible: false,
      data: Prisma.DbNull,
      draftData: SECTION_DEFAULTS[type] as Prisma.InputJsonValue,
      draftPosition: position,
      draftIsVisible: true,
    },
  });
  await audit(prisma, {
    actorId,
    action: "home.section.add",
    targetType: "HomeSection",
    targetId: row.id,
    after: { type },
  });
  return row;
}

/** Validates against the section's schema (invalid data is rejected) and saves it as the draft. */
export async function saveSectionDraft(
  prisma: PrismaClient,
  input: { id: string; data: unknown; actorId: string },
) {
  const row = await prisma.homeSection.findUnique({ where: { id: input.id } });
  if (!row || row.isDraftDeleted) throw new UserError("This section no longer exists.");
  const parsed = parseSection(row.type as SectionType, input.data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new UserError(`${issue.path.join(" ") || "Section"}: ${issue.message}`);
  }
  await prisma.homeSection.update({
    where: { id: row.id },
    data: { draftData: parsed.data as Prisma.InputJsonValue },
  });
  await audit(prisma, {
    actorId: input.actorId,
    action: "home.section.edit",
    targetType: "HomeSection",
    targetId: row.id,
    before: row.draftData ?? row.data,
    after: parsed.data,
  });
  return parsed.data;
}

export async function reorderSections(prisma: PrismaClient, ids: string[], actorId: string) {
  await prisma.$transaction(
    ids.map((id, i) => prisma.homeSection.update({ where: { id }, data: { draftPosition: i } })),
  );
  await audit(prisma, {
    actorId,
    action: "home.section.reorder",
    targetType: "HomeSection",
    after: { ids },
  });
}

export async function setSectionVisibility(
  prisma: PrismaClient,
  input: { id: string; visible: boolean; actorId: string },
) {
  await prisma.homeSection.update({
    where: { id: input.id },
    data: { draftIsVisible: input.visible },
  });
  await audit(prisma, {
    actorId: input.actorId,
    action: input.visible ? "home.section.show" : "home.section.hide",
    targetType: "HomeSection",
    targetId: input.id,
  });
}

export async function duplicateSection(prisma: PrismaClient, id: string, actorId: string) {
  const row = await prisma.homeSection.findUnique({ where: { id } });
  if (!row) throw new UserError("This section no longer exists.");
  const src = effective(row);
  return prisma.$transaction(async (tx) => {
    // Shift the following sections down by one in the draft order.
    const all = (await tx.homeSection.findMany({ where: { isDraftDeleted: false } })).map(
      effective,
    );
    for (const s of all.filter((s) => s.position > src.position)) {
      await tx.homeSection.update({ where: { id: s.id }, data: { draftPosition: s.position + 1 } });
    }
    const copy = await tx.homeSection.create({
      data: {
        type: row.type,
        position: src.position + 1,
        isVisible: false,
        data: Prisma.DbNull,
        draftData: (src.data ?? SECTION_DEFAULTS[src.type]) as Prisma.InputJsonValue,
        draftPosition: src.position + 1,
        draftIsVisible: src.isVisible,
      },
    });
    await audit(tx, {
      actorId,
      action: "home.section.duplicate",
      targetType: "HomeSection",
      targetId: copy.id,
      after: { from: id },
    });
    return copy;
  });
}

export async function removeSection(prisma: PrismaClient, id: string, actorId: string) {
  const row = await prisma.homeSection.findUnique({ where: { id } });
  if (!row) return;
  if (row.data === null) await prisma.homeSection.delete({ where: { id } });
  else await prisma.homeSection.update({ where: { id }, data: { isDraftDeleted: true } });
  await audit(prisma, {
    actorId,
    action: "home.section.delete",
    targetType: "HomeSection",
    targetId: id,
    before: row,
  });
}

/** Copies every draft to the live homepage in one transaction. Refuses if any section is invalid. */
export async function publishHomepage(prisma: PrismaClient, actorId: string) {
  const rows = await prisma.homeSection.findMany();
  const problems: string[] = [];
  for (const row of rows) {
    if (row.isDraftDeleted) continue;
    const e = effective(row);
    const parsed = parseSection(e.type, e.data);
    if (!parsed.success)
      problems.push(`${SECTION_LABELS[e.type]}: ${parsed.error.issues[0]?.message}`);
  }
  if (problems.length)
    throw new UserError(`Fix these sections before publishing. ${problems.join(" ")}`);

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      if (row.isDraftDeleted) {
        await tx.homeSection.delete({ where: { id: row.id } });
        continue;
      }
      const e = effective(row);
      await tx.homeSection.update({
        where: { id: row.id },
        data: {
          data: e.data as Prisma.InputJsonValue,
          position: e.position,
          isVisible: e.isVisible,
          draftData: Prisma.DbNull,
          draftPosition: null,
          draftIsVisible: null,
        },
      });
    }
    await audit(tx, { actorId, action: "home.publish", targetType: "HomeSection" });
  });
}

export async function discardHomepageDraft(prisma: PrismaClient, actorId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.homeSection.deleteMany({ where: { data: { equals: Prisma.DbNull } } });
    await tx.homeSection.updateMany({
      data: {
        draftData: Prisma.DbNull,
        draftPosition: null,
        draftIsVisible: null,
        isDraftDeleted: false,
      },
    });
    await audit(tx, { actorId, action: "home.discard", targetType: "HomeSection" });
  });
}

export type RenderSection = { id: string; type: SectionType; data: unknown };

export async function loadPublishedSections(prisma: PrismaClient): Promise<RenderSection[]> {
  const rows = await prisma.homeSection.findMany({
    where: { isVisible: true, data: { not: Prisma.DbNull } },
    orderBy: { position: "asc" },
  });
  return rows.map((r) => ({ id: r.id, type: r.type as SectionType, data: r.data }));
}

export async function loadDraftSections(prisma: PrismaClient): Promise<RenderSection[]> {
  return (await listDraftSections(prisma))
    .filter((s) => s.isVisible)
    .map((s) => ({ id: s.id, type: s.type, data: s.data }));
}
