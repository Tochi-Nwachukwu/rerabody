"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/admin/status-badge";
import { FormMessage, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import type { ActionResult } from "@/server/actions/safe-action";
import {
  changeStaffRoleAction,
  inviteStaffAction,
  removeStaffAction,
  revokeInviteAction,
  setStaffActiveAction,
} from "@/server/actions/staff";

type Member = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  status: string;
  isOwner: boolean;
  isYou: boolean;
};
type Invite = { id: string; email: string; roleName: string; expiresAt: string };

// A25 staff
export function StaffManager({
  members,
  invites,
  roles,
  canInviteOwner,
}: {
  members: Member[];
  invites: Invite[];
  roles: { id: string; name: string; isOwner: boolean }[];
  canInviteOwner: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const assignable = roles.filter((r) => canInviteOwner || !r.isOwner);
  const [invite, setInvite] = useState({
    email: "",
    roleId: assignable.find((r) => !r.isOwner)?.id ?? "",
  });

  function run<T>(fn: () => Promise<ActionResult<T>>, ok: string) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(ok);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? <FormMessage>{error}</FormMessage> : null}
      <section className="bg-card flex max-w-xl flex-col gap-3 rounded-xl border p-4">
        <h2 className="font-semibold">Invite someone</h2>
        <TextField
          id="inv-email"
          label="Email"
          type="email"
          value={invite.email}
          onChange={(e) => setInvite({ ...invite, email: e.target.value })}
        />
        <Field>
          <FieldLabel htmlFor="inv-role">Role</FieldLabel>
          <select
            id="inv-role"
            className="bg-background h-8 rounded-lg border px-2 text-sm"
            value={invite.roleId}
            onChange={(e) => setInvite({ ...invite, roleId: e.target.value })}
          >
            {assignable.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Button
          className="self-start"
          disabled={pending || !invite.email}
          onClick={() =>
            run(async () => {
              const res = await inviteStaffAction(invite);
              if (res.ok) setInvite({ ...invite, email: "" });
              return res;
            }, "Invitation sent")
          }
        >
          Send invitation
        </Button>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Team</h2>
        <ul className="flex flex-col divide-y rounded-xl border">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">
                  {m.name}{" "}
                  {m.isYou ? <span className="text-muted-foreground text-xs">(you)</span> : null}
                </p>
                <p className="text-muted-foreground text-xs">{m.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={m.status} />
                <label className="sr-only" htmlFor={`role-${m.id}`}>
                  Role for {m.name}
                </label>
                <select
                  id={`role-${m.id}`}
                  className="bg-background h-8 rounded-lg border px-2 text-sm"
                  value={m.roleId}
                  disabled={pending || (m.isOwner && !m.isYou)}
                  onChange={(e) =>
                    run(
                      () => changeStaffRoleAction({ userId: m.id, roleId: e.target.value }),
                      "Role changed",
                    )
                  }
                >
                  {roles
                    .filter((r) => r.id === m.roleId || canInviteOwner || !r.isOwner)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
                {!m.isYou ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || m.isOwner}
                      onClick={() =>
                        run(
                          () =>
                            setStaffActiveAction({ userId: m.id, active: m.status !== "ACTIVE" }),
                          m.status === "ACTIVE" ? "Deactivated" : "Reactivated",
                        )
                      }
                    >
                      {m.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending || m.isOwner}
                      onClick={() =>
                        window.confirm(
                          `Remove ${m.name} from the team? Their account stays as a customer account.`,
                        ) && run(() => removeStaffAction({ userId: m.id }), "Removed from the team")
                      }
                    >
                      Remove
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {invites.length ? (
        <section>
          <h2 className="mb-3 font-semibold">Pending invitations</h2>
          <ul className="flex flex-col divide-y rounded-xl border">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  {i.email} · {i.roleName} · expires{" "}
                  {new Date(i.expiresAt).toLocaleDateString("en-GB")}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(() => revokeInviteAction({ inviteId: i.id }), "Invitation cancelled")
                  }
                >
                  Cancel
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
