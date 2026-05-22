import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function GET() {
  const user = await requireUser();
  if (!user.companyId)
    return NextResponse.json({ ok: false, error: "No company" }, { status: 403 });

  const pins = await prisma.mapZonePin.findMany({
    where: { companyId: user.companyId },
    include: {
      driver: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, pins });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user.companyId)
    return NextResponse.json({ ok: false, error: "No company" }, { status: 403 });

  // Only drivers can place pins
  if (user.role !== "DRIVER" && user.role !== "SUPER_ADMIN")
    return NextResponse.json({ ok: false, error: "Only drivers can place zone pins" }, { status: 403 });

  const driver = await prisma.driverProfile.findUnique({ where: { userId: user.id } });
  if (!driver)
    return NextResponse.json({ ok: false, error: "Driver profile not found" }, { status: 404 });

  const { lat, lng, note } = await req.json();
  if (typeof lat !== "number" || typeof lng !== "number")
    return NextResponse.json({ ok: false, error: "lat/lng required" }, { status: 400 });

  const pin = await prisma.mapZonePin.create({
    data: {
      companyId: user.companyId,
      driverId: driver.id,
      lat,
      lng,
      status: "GREEN",
      note: note ?? null,
    },
  });

  return NextResponse.json({ ok: true, pin });
}
