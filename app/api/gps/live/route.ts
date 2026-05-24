import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

/**
 * GET /api/gps/live
 * Returns the most recent GPS position for every driver who has sent a ping
 * in the last 30 minutes — regardless of whether they have an active load.
 * Used by the dispatcher / admin map.
 */
export async function GET() {
  const me = await requirePermission("gps:read");
  if (!me.companyId) return NextResponse.json({ ok: true, positions: [] });

  const since = new Date(Date.now() - 30 * 60 * 1000); // last 30 min

  // Get the latest ping per driver who was active recently
  const recentPings = await prisma.gPSLocation.findMany({
    where: { companyId: me.companyId, recordedAt: { gte: since } },
    orderBy: { recordedAt: "desc" },
    include: {
      driver: { select: { id: true, firstName: true, lastName: true } },
      truck: { select: { plateNumber: true } },
      load: { select: { id: true, referenceNumber: true, status: true } },
    },
  });

  // Deduplicate: keep only the latest ping per driverId
  const seen = new Set<string>();
  const latest = recentPings.filter((p) => {
    if (!p.driverId || seen.has(p.driverId)) return false;
    seen.add(p.driverId);
    return true;
  });

  const positions = latest.map((p) => ({
    driverId: p.driverId!,
    driverName: p.driver
      ? `${p.driver.firstName} ${p.driver.lastName}`.trim()
      : "Unknown",
    truckPlate: p.truck?.plateNumber ?? null,
    loadRef: p.load?.referenceNumber ?? null,
    loadId: p.load?.id ?? null,
    loadStatus: p.load?.status ?? null,
    lat: p.lat,
    lng: p.lng,
    speed: p.speed,
    heading: p.heading,
    recordedAt: p.recordedAt,
  }));

  return NextResponse.json({ ok: true, positions });
}
