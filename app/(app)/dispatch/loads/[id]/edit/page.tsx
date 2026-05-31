import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { LoadForm } from "@/components/loads/load-form";

export const metadata = { title: "Edit load" };

export default async function EditLoadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requirePermission("loads:write");
  const { id } = await params;
  const where = { companyId: me.companyId ?? undefined };

  const load = await prisma.load.findFirst({ where: { id, ...where } });
  if (!load) notFound();

  const [customers, drivers, trucks, trailers] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={`Editare ${load.referenceNumber}`} />
      <LoadForm
        initial={{ ...load, isHazardous: load.isHazardous ?? false }}
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
      />
    </div>
  );
}
