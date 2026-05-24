import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { LoadForm } from "@/components/loads/load-form";

export const metadata = { title: "New load" };

export default async function NewLoadPage() {
  const me = await requirePermission("loads:write");
  const where = { companyId: me.companyId ?? undefined };

  const [customers, drivers, trucks, trailers] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.driverProfile.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.truck.findMany({
      where,
      orderBy: { plateNumber: "asc" },
      select: { id: true, plateNumber: true, make: true, model: true },
    }),
    prisma.trailer.findMany({
      where,
      orderBy: { plateNumber: "asc" },
      select: { id: true, plateNumber: true },
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
          label: `${t.plateNumber}${t.make ? " · " + t.make : ""}${t.model ? " " + t.model : ""}`,
        }))}
        trailers={trailers.map((t) => ({ id: t.id, label: t.plateNumber }))}
      />
    </div>
  );
}
