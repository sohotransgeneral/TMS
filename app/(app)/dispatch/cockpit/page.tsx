import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  CockpitBoard,
  type CockpitColumn,
} from "@/components/dispatch/cockpit-board";

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

export default async function CockpitPage() {
  const me = await requirePermission("loads:read");

  const loads = await prisma.load.findMany({
    where: {
      companyId: me.companyId ?? undefined,
      status: { notIn: ["CANCELLED"] },
    },
    orderBy: { pickupDate: "asc" },
    include: {
      customer: { select: { name: true } },
      driver: { include: { user: { select: { name: true } } } },
      truck: { select: { plateNumber: true } },
    },
    take: 300,
  });

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

  return (
    <div className="space-y-6">
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

      <CockpitBoard initialLoads={serialised} columns={COLUMNS} />
    </div>
  );
}
