"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import {
  expenseCreateSchema,
  expenseUpdateSchema,
  expenseDecisionSchema,
} from "@/lib/validators/accounting";

export async function createExpense(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("expenses:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const parsed = expenseCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Date invalide", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  // For drivers, auto-attach driverId from their profile.
  let driverId = d.driverId || null;
  if (me.role === "DRIVER" && !driverId) {
    const dp = await prisma.driverProfile.findUnique({ where: { userId: me.id } });
    driverId = dp?.id ?? null;
  }

  const expense = await prisma.expense.create({
    data: {
      companyId: me.companyId,
      type: d.type,
      amount: d.amount,
      currency: d.currency,
      description: d.description,
      occurredAt: d.occurredAt,
      loadId: d.loadId || null,
      truckId: d.truckId || null,
      driverId,
      receiptUrl: d.receiptUrl,
      reportedById: me.id,
      status: "PENDING",
    },
  });

  await logAudit({
    action: "expense.create",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Expense",
    entityId: expense.id,
    meta: { amount: d.amount, type: d.type },
  });

  revalidatePath("/accounting/expenses");
  return success({ id: expense.id }, "Cheltuială înregistrată.");
}

export async function updateExpense(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("expenses:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const parsed = expenseUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Date invalide", parsed.error.flatten().fieldErrors);
  const { id, ...rest } = parsed.data;

  const target = await prisma.expense.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Cheltuială inexistentă.");
  if (target.status === "APPROVED") return failure("Cheltuiala aprobată nu poate fi modificată.");

  const data: Record<string, unknown> = { ...rest };
  if (rest.loadId !== undefined) data.loadId = rest.loadId || null;
  if (rest.truckId !== undefined) data.truckId = rest.truckId || null;
  if (rest.driverId !== undefined) data.driverId = rest.driverId || null;

  await prisma.expense.update({ where: { id }, data });

  await logAudit({
    action: "expense.update",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Expense",
    entityId: id,
  });

  revalidatePath("/accounting/expenses");
  return success({ id }, "Cheltuială actualizată.");
}

export async function decideExpense(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("expenses:approve");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");
  const parsed = expenseDecisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Date invalide", parsed.error.flatten().fieldErrors);
  const { id, decision } = parsed.data;

  const target = await prisma.expense.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Cheltuială inexistentă.");

  await prisma.expense.update({
    where: { id },
    data: {
      status: decision,
      approvedById: me.id,
      approvedAt: new Date(),
    },
  });

  await logAudit({
    action: "expense.decision",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Expense",
    entityId: id,
    meta: { decision },
  });

  revalidatePath("/accounting/expenses");
  return success({ id }, decision === "APPROVED" ? "Cheltuială aprobată." : "Cheltuială respinsă.");
}

export async function deleteExpense(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("expenses:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");
  const id = String(formData.get("id") ?? "");
  if (!id) return failure("ID lipsă.");

  const target = await prisma.expense.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Cheltuială inexistentă.");
  if (target.status === "APPROVED") return failure("Cheltuiala aprobată nu poate fi ștearsă.");

  await prisma.expense.delete({ where: { id } });
  await logAudit({
    action: "expense.delete",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Expense",
    entityId: id,
  });
  revalidatePath("/accounting/expenses");
  return success(null, "Cheltuială ștearsă.");
}
