"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormMessage, TextField } from "@/components/form/text-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PERMISSION_GROUPS } from "@/lib/permission-labels";
import { deleteRoleAction, saveRoleAction } from "@/server/actions/staff";
import type { Permission } from "@/server/permissions";

type Role = {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: Permission[];
  members: number;
};

// A26 roles with the permission grid
export function RolesEditor({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(
    roles.find((r) => !r.isSystem)?.id ?? roles[0]?.id ?? "new",
  );
  const current = roles.find((r) => r.id === selected);
  const [name, setName] = useState(current?.name ?? "");
  const [perms, setPerms] = useState<Set<Permission>>(new Set(current?.permissions ?? []));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const locked = !!current?.isSystem;

  function pick(id: string) {
    const r = roles.find((x) => x.id === id);
    setSelected(id);
    setName(r?.name ?? "");
    setPerms(new Set(r?.permissions ?? []));
    setError(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <nav aria-label="Roles" className="flex flex-col gap-1">
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => pick(r.id)}
            aria-current={selected === r.id}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-sm ${selected === r.id ? "bg-muted font-medium" : "hover:bg-muted/60"}`}
          >
            {r.name}
            <span className="text-muted-foreground text-xs">{r.members}</span>
          </button>
        ))}
        <Button variant="outline" size="sm" className="mt-2" onClick={() => pick("new")}>
          New role
        </Button>
      </nav>
      <div className="flex flex-col gap-5">
        {error ? <FormMessage>{error}</FormMessage> : null}
        {locked ? (
          <p className="text-sm">
            <Badge>Owner</Badge> The Owner role always has every permission and cannot be edited or
            deleted.
          </p>
        ) : null}
        <TextField
          id="role-name"
          label="Role name"
          value={name}
          disabled={locked}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {PERMISSION_GROUPS.map((g) => (
            <fieldset key={g.title} className="flex flex-col gap-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">{g.title}</legend>
              {g.items.map((p) => (
                <label key={p.key} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={locked || perms.has(p.key)}
                    disabled={locked}
                    onCheckedChange={(on) => {
                      const next = new Set(perms);
                      if (on) next.add(p.key);
                      else next.delete(p.key);
                      setPerms(next);
                    }}
                  />
                  <span>
                    {p.label}
                    <span className="text-muted-foreground block font-mono text-[11px]">
                      {p.key}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        {!locked ? (
          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await saveRoleAction({
                    id: selected === "new" ? undefined : selected,
                    name,
                    permissions: [...perms],
                  });
                  if (!res.ok) return setError(res.error);
                  toast.success("Role saved");
                  setSelected(res.data.id);
                  router.refresh();
                })
              }
            >
              Save role
            </Button>
            {selected !== "new" ? (
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (!window.confirm("Delete this role?")) return;
                    const res = await deleteRoleAction({ id: selected });
                    if (!res.ok) return setError(res.error);
                    toast.success("Role deleted");
                    router.refresh();
                    pick(roles.find((r) => r.id !== selected)?.id ?? "new");
                  })
                }
              >
                Delete role
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
