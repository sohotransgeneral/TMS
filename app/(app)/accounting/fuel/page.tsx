import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { parseListParams } from "@/lib/action-helpers";
import { PageHeader } from "@/components/dashboard/page-header";
import { FilterSelect } from "@/components/ui/filter-select";
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
  const canWrite = hasPermission(me.role, "expenses:write");

  const where = {
    companyId: me.companyId ?? undefined,
    ...(truckId ? { truckId } : {}),
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
    me.companyId
      ? prisma.truck.findMany({
          where: { companyId: me.companyId },
          select: { id: true, plateNumber: true },
          orderBy: { plateNumber: "asc" },
        })
      : Promise.resolve([]),
    me.companyId
      ? prisma.user.findMany({
          where: { companyId: me.companyId, role: "DRIVER" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    me.companyId
      ? prisma.load.findMany({
          where: { companyId: me.companyId },
          select: { id: true, referenceNumber: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
  ]);

  const opts = {
    trucks: trucks.map((t) => ({ id: t.id, label: t.plateNumber })),
    drivers: drivers.map((d) => ({ id: d.id, label: d.name ?? "" })),
    loads: loads.map((l) => ({ id: l.id, label: l.referenceNumber })),
  };

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
      <div className="flex flex-wrap gap-3">
        <FilterSelect
          paramKey="truck"
          allLabel="All trucks"
          options={trucks.map((t) => ({ value: t.id, label: t.plateNumber }))}
        />
      </div>

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
                <TableHead className="text-right">Km</TableHead>
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
