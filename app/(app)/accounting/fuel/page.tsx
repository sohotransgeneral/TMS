import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { parseListParams } from "@/lib/action-helpers";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FuelFormDialog,
  DeleteFuelButton,
} from "@/components/accounting/fuel-dialog";
import { FuelFilters } from "@/components/accounting/fuel-filters";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Fuel } from "lucide-react";
import { hasPermission } from "@/lib/permissions";

export const metadata = { title: "Fuel" };

type SP = Record<string, string | string[] | undefined>;

export default async function FuelPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const me = await requirePermission("expenses:read");
  const sp = await searchParams;
  const { page, pageSize, skip } = parseListParams(sp);
  const truckId = typeof sp.truck === "string" ? sp.truck : undefined;
  const driverParam = typeof sp.driver === "string" ? sp.driver : undefined;
  const dateFrom = typeof sp.dateFrom === "string" ? sp.dateFrom : undefined;
  const dateTo = typeof sp.dateTo === "string" ? sp.dateTo : undefined;
  const canWrite = hasPermission(me.role, "expenses:write");

  // If driver, restrict to their assigned truck only
  let driverTruckId: string | undefined;
  let driverProfileId: string | undefined;
  if (me.role === "DRIVER") {
    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId: me.id },
      select: { id: true },
    });
    driverProfileId = driverProfile?.id;
    if (driverProfileId) {
      const activeLoad = await prisma.load.findFirst({
        where: {
          driverId: driverProfileId,
          truckId: { not: null },
          status: { notIn: ["CANCELLED", "PAID"] as never },
        },
        orderBy: { updatedAt: "desc" },
        select: { truckId: true },
      });
      driverTruckId = activeLoad?.truckId ?? undefined;
    }
  }

  // Resolve driverParam (userId) → driverProfileId for filtering
  let filterDriverProfileId: string | undefined;
  if (driverParam) {
    const dp = await prisma.driverProfile.findFirst({
      where: { userId: driverParam, companyId: me.companyId ?? undefined },
      select: { id: true },
    });
    filterDriverProfileId = dp?.id;
  }

  // Date range filter
  const dateFilter =
    dateFrom || dateTo
      ? {
          gte: dateFrom ? new Date(dateFrom) : undefined,
          lte: dateTo ? new Date(`${dateTo}T23:59:59`) : undefined,
        }
      : undefined;

  const where = {
    companyId: me.companyId ?? undefined,
    ...(truckId
      ? { truckId }
      : driverTruckId
        ? { truckId: driverTruckId }
        : {}),
    ...(filterDriverProfileId ? { driverId: filterDriverProfileId } : {}),
    ...(dateFilter ? { occurredAt: dateFilter } : {}),
  };

  const [entries, total, agg, trucks, drivers, loads] = await Promise.all([
    prisma.fuelEntry.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip,
      take: pageSize,
      include: {
        truck: { select: { plateNumber: true } },
        driver: { select: { firstName: true, lastName: true } },
        load: { select: { referenceNumber: true } },
      },
    }),
    prisma.fuelEntry.count({ where }),
    prisma.fuelEntry.aggregate({
      where,
      _sum: { totalAmount: true, liters: true },
    }),
    prisma.truck.findMany({
      where: driverTruckId
        ? { id: driverTruckId }
        : me.companyId
          ? { companyId: me.companyId }
          : {},
      select: { id: true, plateNumber: true },
      orderBy: { plateNumber: "asc" },
    }),
    prisma.driverProfile.findMany({
      where: me.companyId ? { companyId: me.companyId } : {},
      select: { id: true, firstName: true, lastName: true, userId: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.load.findMany({
      where: me.companyId ? { companyId: me.companyId } : {},
      select: { id: true, referenceNumber: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const opts = {
    trucks: trucks.map((t) => ({ id: t.id, label: t.plateNumber })),
    drivers: drivers.map((d) => ({ id: d.id, label: `${d.firstName} ${d.lastName}` })),
    loads: loads.map((l) => ({ id: l.id, label: l.referenceNumber })),
  };

  // For FuelFilters: driver options keyed by userId (for URL param)
  const driverFilterOpts = drivers.map((d) => ({
    value: d.userId,
    label: `${d.firstName} ${d.lastName}`,
  }));

  const sumLiters = agg._sum.liters ?? 0;
  const sumAmount = agg._sum.totalAmount ?? 0;
  const avgPpl = sumLiters > 0 ? sumAmount / sumLiters : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fuel"
        description={`${total} fill-ups · ${sumLiters.toFixed(0)} L · ${formatCurrency(sumAmount)} · avg ${avgPpl.toFixed(3)}/L`}
        action={canWrite ? <FuelFormDialog {...opts} /> : null}
      />
      <FuelFilters
        trucks={trucks.map((t) => ({ value: t.id, label: t.plateNumber }))}
        drivers={driverFilterOpts}
      />

      <div className="rounded-lg border bg-card">
        {entries.length === 0 ? (
          <EmptyState
            icon={<Fuel className="h-10 w-10" />}
            title="No fuel entries found"
            description="Record your first fuel fill-up."
            action={canWrite ? <FuelFormDialog {...opts} /> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Truck</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead className="text-right">Liters</TableHead>
                <TableHead className="text-right">Price/L</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Mi</TableHead>
                <TableHead>Station</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="text-sm">
                    {formatDate(f.occurredAt)}
                  </TableCell>
                  <TableCell>{f.truck?.plateNumber ?? "—"}</TableCell>
                  <TableCell>
                    {f.driver
                      ? `${f.driver.firstName} ${f.driver.lastName}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {f.liters.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {f.pricePerLiter.toFixed(3)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(f.totalAmount, f.currency)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {f.mileage != null
                      ? f.mileage.toLocaleString("ro-RO")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{f.station ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {canWrite && <DeleteFuelButton id={f.id} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination total={total} page={page} pageSize={pageSize} />
    </div>
  );
}
