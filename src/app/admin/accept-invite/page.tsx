import type { Metadata } from "next";
import { Suspense } from "react";

import { AcceptInviteForm } from "@/components/admin/staff/accept-invite-form";
import { AuthCard } from "@/components/auth/auth-card";
import { FormMessage } from "@/components/form/text-field";
import { db } from "@/server/db";
import { findValidInvite } from "@/server/services/staff";

export const metadata: Metadata = { title: "Accept invitation" };

// A2
export default function AcceptInvitePage({ searchParams }: PageProps<"/admin/accept-invite">) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-16">
      <p className="font-heading mb-8 text-2xl font-semibold tracking-[0.12em] uppercase">
        Rera Body admin
      </p>
      <main id="main" className="w-full max-w-sm">
        <AuthCard title="Join the team">
          <Suspense>
            <Invite searchParams={searchParams} />
          </Suspense>
        </AuthCard>
      </main>
    </div>
  );
}

async function Invite({
  searchParams,
}: {
  searchParams: PageProps<"/admin/accept-invite">["searchParams"];
}) {
  const sp = await searchParams;
  const inviteId = typeof sp.invite === "string" ? sp.invite : "";
  const token = typeof sp.token === "string" ? sp.token : "";
  const invite = inviteId && token ? await findValidInvite(db, inviteId, token) : null;
  if (!invite)
    return (
      <FormMessage>
        This invitation has expired or was already used. Ask the store owner for a new one.
      </FormMessage>
    );
  const hasAccount = !!(await db.user.findUnique({
    where: { email: invite.email },
    select: { id: true },
  }));
  return (
    <AcceptInviteForm
      inviteId={invite.id}
      token={token}
      email={invite.email}
      roleName={invite.role.name}
      hasAccount={hasAccount}
    />
  );
}
