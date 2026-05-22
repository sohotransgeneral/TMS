import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <DashboardShell
      role={user.role}
      name={user.name}
      email={user.email}
      companyName={user.company?.name}
    >
      {children}
    </DashboardShell>
  );
}
