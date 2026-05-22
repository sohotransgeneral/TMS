"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { trailerSchema, trailerUpdateSchema } from "@/lib/validators/trailer";

export async function createTrailer(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("trailers:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const parsed = trailerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Date invalide", parsed.error.flatten().fieldErrors);
  }

  const exists = await prisma.trailer.findFirst({
    where: { companyId: me.companyId, plateNumber: parsed.data.plateNumber },
  });
  if (exists) return failure("Există deja o remorcă cu acest număr.");

  const trailer = await prisma.trailer.create({
    data: { ...parsed.data, companyId: me.companyId },
  });

  await logAudit({
    action: "trailer.create",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Trailer",
    entityId: trailer.id,
  });

  revalidatePath("/fleet/trailers");
  return success({ id: trailer.id }, "Remorcă creată.");
}

export async function updateTrailer(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("trailers:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const parsed = trailerUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Date invalide", parsed.error.flatten().fieldErrors);
  }
  const { id, ...data } = parsed.data;

  const target = await prisma.trailer.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) {
    return failure("Remorcă inexistentă.");
  }

  await prisma.trailer.update({ where: { id }, data });

  await logAudit({
    action: "trailer.update",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Trailer",
    entityId: id,
  });

  revalidatePath("/fleet/trailers");
  return success(undefined, "Remorcă actualizată.");
}

export async function deleteTrailer(id: string): Promise<ActionResult> {
  const me = await requirePermission("trailers:write");
  const target = await prisma.trailer.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) {
    return failure("Remorcă inexistentă.");
  }

  await prisma.trailer.delete({ where: { id } });

  await logAudit({
    action: "trailer.delete",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Trailer",
    entityId: id,
  });

  revalidatePath("/fleet/trailers");
  return success(undefined, "Remorcă ștearsă.");
}
