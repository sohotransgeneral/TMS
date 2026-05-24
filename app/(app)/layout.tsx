import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  const companyName = user?.company?.name;
  const logoUrl = user?.company?.logoUrl;

  const title = companyName ?? "TMS";

  return {
    title: {
      default: title,
      template: `%s · ${title}`,
    },
    icons: {
      icon: logoUrl ?? "/favicon.png",
      apple: logoUrl ?? "/apple-touch-icon.png",
    },
  };
}

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
      companyLogoUrl={user.company?.logoUrl}
    >
      {children}
    </DashboardShell>
  );
}
