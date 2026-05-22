import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const STATUS_CYCLE: Record<string, string> = {
  GREEN: "YELLOW",
  YELLOW: "RED",
  RED: "DELETE", // signal to caller to delete
};

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;

  const pin = await prisma.mapZonePin.findUnique({ where: { id } });
  if (!pin) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (pin.companyId !== user.companyId)
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  // Only the driver who placed it (or admin) can cycle it
  const driver = await prisma.driverProfile.findUnique({ where: { userId: user.id } });
  if (user.role !== "SUPER_ADMIN" && user.role !== "COMPANY_ADMIN" && pin.driverId !== driver?.id)
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const next = STATUS_CYCLE[pin.status] ?? "GREEN";

  if (next === "DELETE") {
    await prisma.mapZonePin.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  const updated = await prisma.mapZonePin.update({
    where: { id },
    data: { status: next },
  });
  return NextResponse.json({ ok: true, pin: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;

  const pin = await prisma.mapZonePin.findUnique({ where: { id } });
  if (!pin) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (pin.companyId !== user.companyId)
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  await prisma.mapZonePin.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
