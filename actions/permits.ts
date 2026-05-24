"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";


const permitSchema = z.object({
  type:          z.string().min(1),
  permitNumber:  z.string().optional(),
  jurisdiction:  z.string().optional(),
  description:   z.string().optional(),
  validFrom:     z.string().optional(),
  validTo:       z.string().optional(),
  cost:          z.coerce.number().optional(),
  currency:      z.string().default("USD"),
  permitImageUrl:z.string().optional(),
  invoiceUrl:    z.string().optional(),
  notes:         z.string().optional(),
});

export async function createPermit(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("trucks:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const truckId = formData.get("truckId") as string | null;
  if (!truckId) return failure("truckId is missing.");

  const truck = await prisma.truck.findFirst({
    where: { id: truckId, companyId: me.companyId },
  });
  if (!truck) return failure("Truck not found.");

  const parsed = permitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Invalid data", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const permit = await prisma.truckPermit.create({
    data: {
      companyId:     me.companyId,
      truckId,
      type:          d.type,
      permitNumber:  d.permitNumber || null,
      jurisdiction:  d.jurisdiction || null,
      description:   d.description || null,
      validFrom:     d.validFrom ? new Date(d.validFrom) : null,
      validTo:       d.validTo   ? new Date(d.validTo)   : null,
      cost:          d.cost ?? null,
      currency:      d.currency,
      permitImageUrl:d.permitImageUrl || null,
      invoiceUrl:    d.invoiceUrl || null,
      notes:         d.notes || null,
    },
  });

  await logAudit({
    action: "permit.create",
    userId: me.id,
    companyId: me.companyId,
    entityType: "TruckPermit",
    entityId: permit.id,
    meta: { truckId, type: d.type },
  });

  revalidatePath(`/fleet/trucks/${truckId}`);
  revalidatePath("/fleet/permits");
  return success({ id: permit.id }, "Permit added.");
}

export async function updatePermit(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("trucks:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const id = formData.get("id") as string | null;
  if (!id) return failure("id is missing.");

  const permit = await prisma.truckPermit.findFirst({
    where: { id, companyId: me.companyId },
  });
  if (!permit) return failure("Permit not found.");

  const parsed = permitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Invalid data", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  await prisma.truckPermit.update({
    where: { id },
    data: {
      type:          d.type,
      permitNumber:  d.permitNumber || null,
      jurisdiction:  d.jurisdiction || null,
      description:   d.description || null,
      validFrom:     d.validFrom ? new Date(d.validFrom) : null,
      validTo:       d.validTo   ? new Date(d.validTo)   : null,
      cost:          d.cost ?? null,
      currency:      d.currency,
      permitImageUrl:d.permitImageUrl || null,
      invoiceUrl:    d.invoiceUrl || null,
      notes:         d.notes || null,
    },
  });

  revalidatePath(`/fleet/trucks/${permit.truckId}`);
  revalidatePath("/fleet/permits");
  return success(undefined, "Permit updated.");
}

export async function deletePermit(id: string): Promise<ActionResult> {
  const me = await requirePermission("trucks:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const permit = await prisma.truckPermit.findFirst({
    where: { id, companyId: me.companyId },
  });
  if (!permit) return failure("Permit not found.");

  await prisma.truckPermit.delete({ where: { id } });

  revalidatePath(`/fleet/trucks/${permit.truckId}`);
  revalidatePath("/fleet/permits");
  return success(undefined, "Permit deleted.");
}
