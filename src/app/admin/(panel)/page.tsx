import { FormMessage } from "@/components/form/text-field";
import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/server/auth/session";

// A3 dashboard. Placeholder until Phase 8 adds live figures.
export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const staff = await requireStaff();
  const { denied } = await searchParams;
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${staff.name} (${staff.roleName}).`}
      />
      {denied ? (
        <div className="mb-6">
          <FormMessage>Your role does not include access to that page.</FormMessage>
        </div>
      ) : null}
      <p className="text-muted-foreground text-sm">Store figures will appear here.</p>
    </>
  );
}
