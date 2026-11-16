import type { Metadata } from "next";

import { EmptyState, FilterBar, FilterSelect } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pager, firstParam, pageParam } from "@/components/admin/pager";
import type { Prisma } from "@/generated/prisma/client";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Audit log" };

// A29 audit log
export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requirePagePermission("audit.read");
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() || undefined;
  const actor = firstParam(sp.actor) || undefined;
  const type = firstParam(sp.type) || undefined;
  const page = pageParam(sp.page);
  const take = 50;
  const where: Prisma.AuditLogWhereInput = {
    ...(q ? { OR: [{ action: { contains: q, mode: "insensitive" } }, { targetId: q }] } : {}),
    ...(actor ? { actorId: actor } : {}),
    ...(type ? { targetType: type } : {}),
  };
  const [rows, total, actors, types] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      include: { actor: { select: { name: true } } },
    }),
    db.auditLog.count({ where }),
    db.user.findMany({
      where: { roleId: { not: null } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.auditLog.findMany({
      distinct: ["targetType"],
      select: { targetType: true },
      orderBy: { targetType: "asc" },
    }),
  ]);
  return (
    <>
      <PageHeader title="Audit log" description="Every admin action, who did it and when." />
      <FilterBar action="/admin/audit" q={q} placeholder="Action (e.g. order.refund) or record id">
        <FilterSelect
          name="actor"
          label="Who"
          value={actor}
          options={actors.map((a) => ({ value: a.id, label: a.name }))}
        />
        <FilterSelect
          name="type"
          label="Record"
          value={type}
          options={types.map((t) => ({ value: t.targetType, label: t.targetType }))}
        />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title="No entries" />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-xs">{r.action}</span>
                  <span>{r.actor?.name ?? "System"}</span>
                  <span className="text-muted-foreground">
                    {r.targetType}
                    {r.targetId ? ` ${r.targetId.slice(0, 10)}` : ""}
                  </span>
                  <span className="text-muted-foreground ml-auto text-xs">
                    {r.createdAt.toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </summary>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium">Before</p>
                    <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs">
                      {r.before ? JSON.stringify(r.before, null, 2) : "—"}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-medium">After</p>
                    <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs">
                      {r.after ? JSON.stringify(r.after, null, 2) : "—"}
                    </pre>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <Pager
        page={page}
        pageCount={Math.max(1, Math.ceil(total / take))}
        params={{ q, actor, type }}
        basePath="/admin/audit"
      />
    </>
  );
}
