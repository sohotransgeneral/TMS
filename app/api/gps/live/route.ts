import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

/**
 * GET /api/gps/live
 * Returns the most recent GPS position per driver currently on an active load.
 * Used by the dispatcher map.
 */
export async function GET() {
  const me = await requirePermission("gps:read");
  if (!me.companyId) return NextResponse.json({ ok: true, positions: [] });

  // For each driver with an active load, pick the latest GPS row.
  const active = await prisma.load.findMany({
    where: {
      companyId: me.companyId,
      status: { in: ["DRIVER_ACCEPTED", "ON_WAY_TO_PICKUP", "AT_PICKUP", "LOADED", "IN_TRANSIT", "AT_DELIVERY"] },
      driverId: { not: null },
    },
    select: {
      id: true,
      referenceNumber: true,
      status: true,
      driverId: true,
      driver: { select: { firstName: true, lastName: true } },
      truck: { select: { plateNumber: true } },
    },
  });

  const driverIds = active.map((l) => l.driverId!).filter(Boolean);
  if (driverIds.length === 0) return NextResponse.json({ ok: true, positions: [] });

  const positions = await Promise.all(
    driverIds.map(async (driverId) => {
      const last = await prisma.gPSLocation.findFirst({
        where: { companyId: me.companyId!, driverId },
        orderBy: { recordedAt: "desc" },
      });
      if (!last) return null;
      const load = active.find((l) => l.driverId === driverId)!;
      return {
        driverId,
        driverName: `${load.driver?.firstName ?? ""} ${load.driver?.lastName ?? ""}`.trim(),
        truckPlate: load.truck?.plateNumber ?? null,
        loadRef: load.referenceNumber,
        loadId: load.id,
        loadStatus: load.status,
        lat: last.lat,
        lng: last.lng,
        speed: last.speed,
        heading: last.heading,
        recordedAt: last.recordedAt,
      };
    }),
  );

  return NextResponse.json({ ok: true, positions: positions.filter(Boolean) });
}
