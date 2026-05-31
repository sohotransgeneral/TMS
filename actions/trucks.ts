"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { truckSchema, truckUpdateSchema } from "@/lib/validators/truck";

export async function createTruck(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("trucks:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = truckSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
  }

  const exists = await prisma.truck.findFirst({
    where: { companyId: me.companyId, plateNumber: parsed.data.plateNumber },
  });
  if (exists) return failure("A truck with this number already exists.");

  const maxTruck = await prisma.truck.findFirst({
    where: { companyId: me.companyId },
    orderBy: { fleetNumber: "desc" },
    select: { fleetNumber: true },
  });
  const fleetNumber = parsed.data.fleetNumber ?? (maxTruck?.fleetNumber ?? 0) + 1;

  const truck = await prisma.truck.create({
    data: { ...parsed.data, companyId: me.companyId, fleetNumber },
  });

  await logAudit({
    action: "truck.create",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Truck",
    entityId: truck.id,
  });

  revalidatePath("/fleet/trucks");
  return success({ id: truck.id }, "Camion creat.");
}

export async function updateTruck(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("trucks:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = truckUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
  }
  const { id, ...data } = parsed.data;
  // Explicitly null-out pairedTrailerId when cleared
  const cleanData = { ...data, pairedTrailerId: data.pairedTrailerId ?? null };

  const target = await prisma.truck.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) {
    return failure("Truck not found.");
  }

  const updated = await prisma.truck.update({ where: { id }, data: cleanData, select: { pairedTrailerId: true } });

  // Bidirectional sync: update the paired trailer's pairedTruckId
  const newPaired = updated.pairedTrailerId ?? null;
  const oldPaired = target.pairedTrailerId ?? null;
  if (newPaired !== oldPaired) {
    if (oldPaired) {
      await prisma.trailer.update({ where: { id: oldPaired }, data: { pairedTruckId: null } });
    }
    if (newPaired) {
      await prisma.trailer.update({ where: { id: newPaired }, data: { pairedTruckId: id } });
    }
  } else if (newPaired) {
    // Same value — still ensure the back-link exists (e.g. was never set)
    await prisma.trailer.update({ where: { id: newPaired }, data: { pairedTruckId: id } });
  }

  await logAudit({
    action: "truck.update",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Truck",
    entityId: id,
  });

  revalidatePath("/fleet/trucks");
  return success(undefined, "Camion actualizat.");
}

export async function deleteTruck(id: string): Promise<ActionResult> {
  const me = await requirePermission("trucks:write");
  const target = await prisma.truck.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) {
    return failure("Truck not found.");
  }

  await prisma.truck.delete({ where: { id } });

  await logAudit({
    action: "truck.delete",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Truck",
    entityId: id,
  });

  revalidatePath("/fleet/trucks");
  return success(undefined, "Truck deleted.");
}
