"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { fuelCreateSchema, fuelUpdateSchema } from "@/lib/validators/accounting";

export async function createFuelEntry(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("expenses:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const parsed = fuelCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Date invalide", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  let driverId = d.driverId || null;
  if (me.role === "DRIVER" && !driverId) {
    const dp = await prisma.driverProfile.findUnique({ where: { userId: me.id } });
    driverId = dp?.id ?? null;
  }
  const totalAmount = d.totalAmount ?? +(d.liters * d.pricePerLiter).toFixed(2);

  const entry = await prisma.fuelEntry.create({
    data: {
      companyId: me.companyId,
      truckId: d.truckId || null,
      driverId,
      loadId: d.loadId || null,
      liters: d.liters,
      pricePerLiter: d.pricePerLiter,
      totalAmount,
      currency: d.currency,
      station: d.station,
      mileage: d.mileage,
      occurredAt: d.occurredAt,
      receiptUrl: d.receiptUrl,
    },
  });

  // Update truck mileage if new value is greater
  if (d.truckId && d.mileage) {
    const truck = await prisma.truck.findUnique({ where: { id: d.truckId }, select: { mileage: true } });
    if (truck && (truck.mileage ?? 0) < d.mileage) {
      await prisma.truck.update({ where: { id: d.truckId }, data: { mileage: d.mileage } });
    }
  }

  await logAudit({
    action: "fuel.create",
    userId: me.id,
    companyId: me.companyId,
    entityType: "FuelEntry",
    entityId: entry.id,
    meta: { liters: d.liters, totalAmount },
  });

  revalidatePath("/accounting/fuel");
  return success({ id: entry.id }, "Alimentare înregistrată.");
}

export async function updateFuelEntry(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("expenses:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const parsed = fuelUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Date invalide", parsed.error.flatten().fieldErrors);
  const { id, ...rest } = parsed.data;

  const target = await prisma.fuelEntry.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Alimentare inexistentă.");

  const data: Record<string, unknown> = { ...rest };
  if (rest.truckId !== undefined) data.truckId = rest.truckId || null;
  if (rest.driverId !== undefined) data.driverId = rest.driverId || null;
  if (rest.loadId !== undefined) data.loadId = rest.loadId || null;
  if (rest.liters != null && rest.pricePerLiter != null && rest.totalAmount == null) {
    data.totalAmount = +(rest.liters * rest.pricePerLiter).toFixed(2);
  }

  await prisma.fuelEntry.update({ where: { id }, data });
  revalidatePath("/accounting/fuel");
  return success({ id }, "Alimentare actualizată.");
}

export async function deleteFuelEntry(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("expenses:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");
  const id = String(formData.get("id") ?? "");
  if (!id) return failure("ID lipsă.");
  const target = await prisma.fuelEntry.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Alimentare inexistentă.");
  await prisma.fuelEntry.delete({ where: { id } });
  revalidatePath("/accounting/fuel");
  return success(null, "Alimentare ștearsă.");
}
