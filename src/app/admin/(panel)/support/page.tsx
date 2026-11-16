import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, FilterBar, FilterSelect } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pager, firstParam, pageParam } from "@/components/admin/pager";
import { StatusBadge } from "@/components/admin/status-badge";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listTickets } from "@/server/services/support";

export const metadata: Metadata = { title: "Support" };

// A17 support inbox
export default async function SupportPage({ searchParams }: PageProps<"/admin/support">) {
  await requirePagePermission("support.manage");
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() || undefined;
  const statusParam = firstParam(sp.status);
  const status = statusParam === "CLOSED" ? "CLOSED" : statusParam === "all" ? undefined : "OPEN";
  const { items, total, page, pageCount } = await listTickets(db, {
    q,
    status,
    page: pageParam(sp.page),
  });
  return (
    <>
      <PageHeader
        title="Support"
        description={`${total} ${status ? status.toLowerCase() : ""} ticket${total === 1 ? "" : "s"}`}
      />
      <FilterBar action="/admin/support" q={q} placeholder="Reference, email or subject">
        <FilterSelect
          name="status"
          label="Status"
          value={statusParam}
          options={[
            { value: "CLOSED", label: "Closed" },
            { value: "all", label: "Open and closed" },
          ]}
        />
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState title="No tickets" />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {items.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/support/${t.id}`}
                className="hover:bg-muted/50 flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.subject}</p>
                  <p className="text-muted-foreground text-xs">
                    {t.number} · {t.name} ({t.email}) · {t._count.messages} message
                    {t._count.messages === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={t.status} />
                  <span className="text-muted-foreground text-xs">
                    {t.updatedAt.toLocaleDateString("en-GB")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager
        page={page}
        pageCount={pageCount}
        params={{ q, status: statusParam }}
        basePath="/admin/support"
      />
    </>
  );
}
