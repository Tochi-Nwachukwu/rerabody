import type { Metadata } from "next";
import { Suspense } from "react";

import { ProfileForms } from "@/components/store/account/profile-forms";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Profile" };

// S22
export default function ProfilePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const user = await requireUser("/account/profile");
  return <ProfileForms name={user.name} phone={user.phone ?? ""} email={user.email} />;
}
