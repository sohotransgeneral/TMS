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
import { notifyEvent } from "@/lib/notifications";

export async function createMaintenance(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("maintenance:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = maintenanceCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Invalid data", parsed.error.flatten().fieldErrors);
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

  await notifyEvent({
    companyId: me.companyId,
    topic: "maintenance",
    type: "MAINTENANCE",
    title: `Maintenance scheduled: ${d.title}`,
    body: d.scheduledAt ? `Scheduled for ${d.scheduledAt.toString()}` : undefined,
    link: `/fleet/maintenance`,
    roles: ["COMPANY_ADMIN", "FLEET_MANAGER"],
  });

  revalidatePath("/fleet/maintenance");
  return success({ id: m.id }, "Maintenance recorded.");
}

export async function updateMaintenance(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("maintenance:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = maintenanceUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Invalid data", parsed.error.flatten().fieldErrors);
  const { id, ...rest } = parsed.data;

  const target = await prisma.maintenance.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Maintenance not found.");

  const data: Record<string, unknown> = { ...rest };
  if (rest.truckId !== undefined) data.truckId = rest.truckId || null;
  if (rest.trailerId !== undefined) data.trailerId = rest.trailerId || null;
  // If marking completed and no completedAt was provided, set now
  if (rest.status === "COMPLETED" && !rest.completedAt && !target.completedAt) {
    data.completedAt = new Date();
  }

  await prisma.maintenance.update({ where: { id }, data });
  revalidatePath("/fleet/maintenance");
  return success({ id }, "Maintenance updated.");
}

export async function deleteMaintenance(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("maintenance:write");
  if (!me.companyId) return failure("You are not assigned to a company.");
  const id = String(formData.get("id") ?? "");
  if (!id) return failure("ID is missing.");
  const target = await prisma.maintenance.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Maintenance not found.");
  await prisma.maintenance.delete({ where: { id } });
  revalidatePath("/fleet/maintenance");
  return success(null, "Maintenance deleted.");
}
