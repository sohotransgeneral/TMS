import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { parseListParams, buildSearch } from "@/lib/action-helpers";
import { PageHeader } from "@/components/dashboard/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LoadStatusBadge,
  LoadRefLink,
} from "@/components/loads/load-status-badge";
import { LOAD_STATUS_LABELS } from "@/lib/validators/load";
import { Plus, PackageOpen } from "lucide-react";
import { LoadImportDialog } from "@/components/loads/load-import-dialog";
import { DateRangeFilter } from "@/components/ui/date-range-filter";

export const metadata = { title: "Loads" };

type SP = Record<string, string | string[] | undefined>;

export default async function LoadsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const me = await requirePermission("loads:read");
  const sp = await searchParams;
  const { page, pageSize, q, skip } = parseListParams(sp);
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const driverId = typeof sp.driver === "string" ? sp.driver : undefined;
  const truckId = typeof sp.truck === "string" ? sp.truck : undefined;
  const customerId = typeof sp.customer === "string" ? sp.customer : undefined;
  const dateFrom = typeof sp.dateFrom === "string" ? sp.dateFrom : undefined;
  const dateTo = typeof sp.dateTo === "string" ? sp.dateTo : undefined;

  const where = {
    companyId: me.companyId ?? undefined,
    ...(status ? { status: status as never } : {}),
    ...(driverId ? { driverId } : {}),
    ...(truckId ? { truckId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(dateFrom || dateTo
      ? {
          pickupDate: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo + "T23:59:59") } : {}),
          },
        }
      : {}),
    ...buildSearch(q, [
      "referenceNumber",
      "pickupCity",
      "deliveryCity",
      "pickupAddress",
      "deliveryAddress",
    ]),
  };

  const companyWhere = { companyId: me.companyId ?? undefined };

  const [loads, total, customers, drivers, trucks, trailers] =
    await Promise.all([
      prisma.load.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          referenceNumber: true,
          status: true,
          loadType: true,
          pickupCompanyName: true,
          pickupCity: true,
          pickupState: true,
          pickupZip: true,
          pickupCountry: true,
          pickupDate: true,
          deliveryCompanyName: true,
          deliveryCity: true,
          deliveryState: true,
          deliveryZip: true,
          deliveryCountry: true,
          price: true,
          currency: true,
          customer: { select: { name: true } },
          truck: { select: { plateNumber: true, fleetNumber: true } },
          driver: { select: { user: { select: { name: true } } } },
        },
      }),
      prisma.load.count({ where }),
      prisma.customer.findMany({
        where: companyWhere,
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.driverProfile.findMany({
        where: companyWhere,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.truck.findMany({
        where: companyWhere,
        orderBy: { plateNumber: "asc" },
        select: { id: true, plateNumber: true, make: true, model: true },
      }),
      prisma.trailer.findMany({
        where: companyWhere,
        orderBy: { plateNumber: "asc" },
        select: { id: true, plateNumber: true },
      }),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loads"
        description="All company loads."
        action={
          <div className="flex items-center gap-2">
            <LoadImportDialog
              customers={customers.map((c) => ({ id: c.id, label: c.name }))}
              drivers={drivers.map((d) => ({
                id: d.id,
                label: d.user?.name ?? "Driver",
              }))}
              trucks={trucks.map((t) => ({
                id: t.id,
                label: `${t.plateNumber}${t.make ? " · " + t.make : ""}${t.model ? " " + t.model : ""}`,
              }))}
              trailers={trailers.map((t) => ({
                id: t.id,
                label: t.plateNumber,
              }))}
            />
            <Button asChild>
              <Link href="/dispatch/loads/new">
                <Plus className="mr-2 h-4 w-4" /> New Load
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search by reference, city, address…" />
        <FilterSelect
          paramKey="status"
          allLabel="All statuses"
          options={Object.entries(LOAD_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <FilterSelect
          paramKey="driver"
          allLabel="All drivers"
          options={drivers.map((d) => ({
            value: d.id,
            label: d.user?.name ?? "Driver",
          }))}
        />
        <FilterSelect
          paramKey="truck"
          allLabel="All trucks"
          options={trucks.map((t) => ({
            value: t.id,
            label: `${t.plateNumber}${t.make ? " · " + t.make : ""}`,
          }))}
        />
        <FilterSelect
          paramKey="customer"
          allLabel="All customers"
          options={customers.map((c) => ({
            value: c.id,
            label: c.name,
          }))}
        />
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} />
        <div className="ml-auto flex gap-2 text-sm">
          <Link
            href="/dispatch/cockpit"
            className="text-primary hover:underline"
          >
            View Kanban →
          </Link>
          <Link href="/dispatch/map" className="text-primary hover:underline">
            Live Map →
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        {loads.length === 0 ? (
          <EmptyState
            icon={<PackageOpen className="h-10 w-10" />}
            title="No loads found"
            description="Create the first load to assign it to a driver."
            action={
              <Button asChild>
                <Link href="/dispatch/loads/new">
                  <Plus className="mr-2 h-4 w-4" /> New load
                </Link>
              </Button>
            }
          />
        ) : (
          <Table className="text-xs whitespace-nowrap">
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">ID</TableHead>
                <TableHead>Shipper</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="w-10">St.</TableHead>
                <TableHead className="w-10">Cty</TableHead>
                <TableHead className="w-16">Zip</TableHead>
                <TableHead>Consignee</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="w-10">St.</TableHead>
                <TableHead className="w-10">Cty</TableHead>
                <TableHead className="w-16">Zip</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10">LTL</TableHead>
                <TableHead className="w-12">Truck</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono">
                    <LoadRefLink
                      id={l.id}
                      referenceNumber={l.referenceNumber}
                    />
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate">
                    {l.pickupCompanyName ?? "—"}
                  </TableCell>
                  <TableCell>{l.pickupCity ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.pickupState ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.pickupCountry ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.pickupZip ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate">
                    {l.deliveryCompanyName ?? "—"}
                  </TableCell>
                  <TableCell>{l.deliveryCity ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.deliveryState ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.deliveryCountry ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.deliveryZip ?? "—"}
                  </TableCell>
                  <TableCell>
                    <LoadStatusBadge status={l.status} />
                  </TableCell>
                  <TableCell>{l.loadType === "LTL" ? "Yes" : "No"}</TableCell>
                  <TableCell className="font-mono">
                    {l.truck
                      ? l.truck.fleetNumber != null
                        ? `${l.truck.fleetNumber}`
                        : l.truck.plateNumber
                      : "—"}
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
