"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import {
  maintenanceCreateSchema,
  maintenanceUpdateSchema,
} from "@/lib/validators/maintenance";

export async function createMaintenance(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("maintenance:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const parsed = maintenanceCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Date invalide", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const m = await prisma.maintenance.create({
    data: {
      companyId: me.companyId,
      truckId: d.truckId || null,
      trailerId: d.trailerId || null,
      title: d.title,
      description: d.description,
      scheduledAt: d.scheduledAt,
      completedAt: d.completedAt,
      cost: d.cost,
      currency: d.currency,
      mileage: d.mileage,
      partsReplaced: d.partsReplaced ?? [],
      status: d.status,
      notes: d.notes,
      documentUrl: d.documentUrl,
    },
  });

  await logAudit({
    action: "maintenance.create",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Maintenance",
    entityId: m.id,
    meta: { title: d.title },
  });

  revalidatePath("/fleet/maintenance");
  return success({ id: m.id }, "Mentenanță înregistrată.");
}

export async function updateMaintenance(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("maintenance:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const parsed = maintenanceUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Date invalide", parsed.error.flatten().fieldErrors);
  const { id, ...rest } = parsed.data;

  const target = await prisma.maintenance.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Mentenanță inexistentă.");

  const data: Record<string, unknown> = { ...rest };
  if (rest.truckId !== undefined) data.truckId = rest.truckId || null;
  if (rest.trailerId !== undefined) data.trailerId = rest.trailerId || null;
  // If marking completed and no completedAt was provided, set now
  if (rest.status === "COMPLETED" && !rest.completedAt && !target.completedAt) {
    data.completedAt = new Date();
  }

  await prisma.maintenance.update({ where: { id }, data });
  revalidatePath("/fleet/maintenance");
  return success({ id }, "Mentenanță actualizată.");
}

export async function deleteMaintenance(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("maintenance:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");
  const id = String(formData.get("id") ?? "");
  if (!id) return failure("ID lipsă.");
  const target = await prisma.maintenance.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Mentenanță inexistentă.");
  await prisma.maintenance.delete({ where: { id } });
  revalidatePath("/fleet/maintenance");
  return success(null, "Mentenanță ștearsă.");
}
