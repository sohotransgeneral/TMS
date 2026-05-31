import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getCurrentUser } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { LoadForm } from "@/components/loads/load-form";

export const metadata = { title: "New load" };

export default async function NewLoadPage() {
  const me = await requirePermission("loads:write");
  const currentUser = await getCurrentUser();
  const where = { companyId: me.companyId ?? undefined };

  const LOADS_WRITE_ROLES = ["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"];

  const [customers, drivers, trucks, trailers, loadUsers] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.driverProfile.findMany({
      where,
      select: {
        id: true,
        truckId: true,
        trailerId: true,
        user: { select: { name: true } },
      },
    }),
    prisma.truck.findMany({
      where,
      orderBy: { fleetNumber: "asc" },
      select: {
        id: true,
        plateNumber: true,
        make: true,
        model: true,
        fleetNumber: true,
        pairedTrailerId: true,
      },
    }),
    prisma.trailer.findMany({
      where,
      orderBy: { fleetNumber: "asc" },
      select: {
        id: true,
        plateNumber: true,
        fleetNumber: true,
        pairedTruckId: true,
      },
    }),
    prisma.user.findMany({
      where: {
        companyId: me.companyId ?? undefined,
        role: { in: LOADS_WRITE_ROLES as never[] },
      },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New load"
        description="Create a new load and (optionally) assign resources directly."
      />
      <LoadForm
        customers={customers.map((c) => ({ id: c.id, label: c.name }))}
        drivers={drivers.map((d) => ({
          id: d.id,
          label: d.user?.name ?? "Driver",
        }))}
        trucks={trucks.map((t) => ({
          id: t.id,
          label: `${t.fleetNumber != null ? `#${t.fleetNumber} · ` : ""}${t.plateNumber}${t.make ? " · " + t.make : ""}${t.model ? " " + t.model : ""}`,
          pairedTrailerId: t.pairedTrailerId ?? null,
        }))}
        trailers={trailers.map((t) => ({
          id: t.id,
          label: `${t.fleetNumber != null ? `#${t.fleetNumber} · ` : ""}${t.plateNumber}`,
          pairedTruckId: t.pairedTruckId ?? null,
        }))}
        driverAssignments={drivers.map((d) => ({
          id: d.id,
          truckId: d.truckId,
          trailerId: d.trailerId,
        }))}
        userName={currentUser?.name ?? undefined}
        companyName={currentUser?.company?.name ?? undefined}
        enteredByUsers={loadUsers
          .map((u) => u.name)
          .filter((n): n is string => n != null)}
      />
    </div>
  );
}
