"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { gpsPingSchema } from "@/lib/validators/gps";

/**
 * Records a GPS position. Used by drivers from the mobile app.
 * If a `loadId` is provided we attach it; otherwise we attach the current
 * in-progress load of the driver (if any).
 */
export async function pingGps(input: unknown): Promise<ActionResult> {
  const me = await requirePermission("gps:write");
  if (!me.companyId) return failure("Lipsă companie.");

  const parsed = gpsPingSchema.safeParse(input);
  if (!parsed.success) {
    return failure("Date GPS invalide", parsed.error.flatten().fieldErrors);
  }

  const driver = await prisma.driverProfile.findUnique({ where: { userId: me.id } });
  if (!driver) return failure("Utilizatorul nu este șofer.");

  let loadId = parsed.data.loadId;
  let truckId: string | undefined;

  if (!loadId) {
    const active = await prisma.load.findFirst({
      where: {
        companyId: me.companyId,
        driverId: driver.id,
        status: { in: ["DRIVER_ACCEPTED", "ON_WAY_TO_PICKUP", "AT_PICKUP", "LOADED", "IN_TRANSIT", "AT_DELIVERY"] },
      },
      orderBy: { pickupDate: "asc" },
      select: { id: true, truckId: true },
    });
    if (active) {
      loadId = active.id;
      truckId = active.truckId ?? undefined;
    }
  }

  await prisma.gPSLocation.create({
    data: {
      companyId: me.companyId,
      driverId: driver.id,
      loadId: loadId || undefined,
      truckId,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      speed: parsed.data.speed,
      heading: parsed.data.heading,
      accuracy: parsed.data.accuracy,
      recordedAt: parsed.data.recordedAt ?? new Date(),
    },
  });

  return success(undefined, "Poziție înregistrată.");
}
