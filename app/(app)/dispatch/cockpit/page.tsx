import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  CockpitBoard,
  type CockpitColumn,
} from "@/components/dispatch/cockpit-board";
import { CockpitFilters } from "@/components/dispatch/cockpit-filters";

export const metadata = { title: "Dispatch Cockpit" };

const COLUMNS: CockpitColumn[] = [
  { key: "Backlog", statuses: ["DRAFT"] },
  { key: "Assigned", statuses: ["ASSIGNED", "DRIVER_ACCEPTED"] },
  {
    key: "En Route to Pickup",
    statuses: ["ON_WAY_TO_PICKUP", "AT_PICKUP"],
  },
  {
    key: "Loaded / In Transit",
    statuses: ["LOADED", "IN_TRANSIT", "AT_DELIVERY"],
  },
  { key: "Delivered / POD", statuses: ["DELIVERED", "POD_UPLOADED"] },
  { key: "Invoiced / Paid", statuses: ["INVOICED", "PAID"] },
];

type SP = Promise<{
  truckId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
  period?: string;
}>;

export default async function CockpitPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const me = await requirePermission("loads:read");
  const sp = await searchParams;

  // Build pickup-date filter
  const pickupFilter: { gte?: Date; lte?: Date } = {};
  if (sp.dateFrom) pickupFilter.gte = new Date(sp.dateFrom);
  if (sp.dateTo) {
    const end = new Date(sp.dateTo);
    end.setHours(23, 59, 59, 999);
    pickupFilter.lte = end;
  }

  const [loads, trucks, drivers] = await Promise.all([
    prisma.load.findMany({
      where: {
        companyId: me.companyId ?? undefined,
        status: { notIn: ["CANCELLED"] },
        ...(sp.truckId ? { truckId: sp.truckId } : {}),
        ...(sp.driverId ? { driverId: sp.driverId } : {}),
        ...(Object.keys(pickupFilter).length
          ? { pickupDate: pickupFilter }
          : {}),
      },
      orderBy: { pickupDate: "asc" },
      include: {
        customer: { select: { name: true } },
        driver: { include: { user: { select: { name: true } } } },
        truck: { select: { plateNumber: true } },
      },
      take: 300,
    }),
    prisma.truck.findMany({
      where: { companyId: me.companyId ?? undefined },
      orderBy: { plateNumber: "asc" },
      select: { id: true, plateNumber: true },
    }),
    prisma.driverProfile.findMany({
      where: { companyId: me.companyId ?? undefined },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  // Serialise dates for the client component
  const serialised = loads.map((l) => ({
    id: l.id,
    referenceNumber: l.referenceNumber,
    status: l.status,
    pickupDate: l.pickupDate?.toISOString() ?? null,
    pickupCity: l.pickupCity,
    pickupAddress: l.pickupAddress,
    deliveryCity: l.deliveryCity,
    deliveryAddress: l.deliveryAddress,
    price: l.price,
    currency: l.currency,
    customer: l.customer,
    driver: l.driver ? { user: { name: l.driver.user.name } } : null,
    truck: l.truck,
  }));

  const truckOpts = trucks.map((t) => ({
    value: t.id,
    label: t.plateNumber,
  }));
  const driverOpts = drivers.map((d) => ({
    value: d.id,
    label: d.user?.name ?? `${d.firstName} ${d.lastName}`.trim() ?? "(no name)",
  }));

  // Key that remounts the board when filters change so its internal state resets
  const boardKey = `${sp.truckId ?? ""}|${sp.driverId ?? ""}|${sp.dateFrom ?? ""}|${sp.dateTo ?? ""}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dispatch Cockpit"
        description="Drag loads between columns to update their status."
        action={
          <Link
            href="/dispatch/loads"
            className="text-sm text-primary hover:underline"
          >
            ← List view
          </Link>
        }
      />

      <CockpitFilters trucks={truckOpts} drivers={driverOpts} />

      <CockpitBoard
        key={boardKey}
        initialLoads={serialised}
        columns={COLUMNS}
      />
    </div>
  );
}
