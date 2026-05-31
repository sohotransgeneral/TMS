"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { trailerSchema, trailerUpdateSchema } from "@/lib/validators/trailer";

export async function createTrailer(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("trailers:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = trailerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
  }

  const exists = await prisma.trailer.findFirst({
    where: { companyId: me.companyId, plateNumber: parsed.data.plateNumber },
  });
  if (exists) return failure("A trailer with this number already exists.");

  const maxTrailer = await prisma.trailer.findFirst({
    where: { companyId: me.companyId },
    orderBy: { fleetNumber: "desc" },
    select: { fleetNumber: true },
  });
  const fleetNumber = parsed.data.fleetNumber ?? (maxTrailer?.fleetNumber ?? 0) + 1;

  const trailer = await prisma.trailer.create({
    data: { ...parsed.data, companyId: me.companyId, fleetNumber },
  });

  await logAudit({
    action: "trailer.create",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Trailer",
    entityId: trailer.id,
  });

  revalidatePath("/fleet/trucks");
  return success({ id: trailer.id }, "Trailer created.");
}

export async function updateTrailer(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("trailers:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = trailerUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
  }
  const { id, ...data } = parsed.data;

  const target = await prisma.trailer.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) {
    return failure("Trailer not found.");
  }

  const updated = await prisma.trailer.update({ where: { id }, data, select: { pairedTruckId: true } });

  // Bidirectional sync: update the paired truck's pairedTrailerId
  const newPaired = updated.pairedTruckId ?? null;
  const oldPaired = target.pairedTruckId ?? null;
  if (newPaired !== oldPaired) {
    if (oldPaired) {
      await prisma.truck.update({ where: { id: oldPaired }, data: { pairedTrailerId: null } });
    }
    if (newPaired) {
      await prisma.truck.update({ where: { id: newPaired }, data: { pairedTrailerId: id } });
    }
  }

  await logAudit({
    action: "trailer.update",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Trailer",
    entityId: id,
  });

  revalidatePath("/fleet/trucks");
  return success(undefined, "Trailer updated.");
}

export async function deleteTrailer(id: string): Promise<ActionResult> {
  const me = await requirePermission("trailers:write");
  const target = await prisma.trailer.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) {
    return failure("Trailer not found.");
  }

  await prisma.trailer.delete({ where: { id } });

  await logAudit({
    action: "trailer.delete",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Trailer",
    entityId: id,
  });

  revalidatePath("/fleet/trucks");
  return success(undefined, "Trailer deleted.");
}
