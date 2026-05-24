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
import { notifyEvent } from "@/lib/notifications";

export async function createExpense(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("expenses:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = expenseCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Invalid data", parsed.error.flatten().fieldErrors);
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

  // Fetch driver / truck / load context for rich body
  const [expDriver, expTruck, expLoad] = await Promise.all([
    driverId
      ? prisma.driverProfile.findUnique({
          where: { id: driverId },
          select: { firstName: true, lastName: true },
        })
      : null,
    d.truckId
      ? prisma.truck.findUnique({ where: { id: d.truckId }, select: { plateNumber: true } })
      : null,
    d.loadId
      ? prisma.load.findUnique({
          where: { id: d.loadId },
          select: { referenceNumber: true },
        })
      : null,
  ]);

  const expBodyLines: string[] = [
    `Type: ${d.type} | Amount: ${d.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${d.currency}`,
  ];
  if (expDriver)
    expBodyLines.push(
      `Driver: ${expDriver.firstName} ${expDriver.lastName}${
        expTruck ? ` | Truck: ${expTruck.plateNumber}` : ""
      }`,
    );
  else if (expTruck) expBodyLines.push(`Truck: ${expTruck.plateNumber}`);
  if (expLoad) expBodyLines.push(`Load: ${expLoad.referenceNumber}`);
  if (d.description) expBodyLines.push(`Note: ${d.description}`);

  await notifyEvent({
    companyId: me.companyId,
    topic: "expenses",
    type: "EXPENSE_SUBMITTED",
    title: `🧾 Expense submitted: ${d.type}`,
    body: expBodyLines.join("\n"),
    link: `/accounting/expenses`,
    roles: ["COMPANY_ADMIN", "ACCOUNTANT"],
  });

  revalidatePath("/accounting/expenses");
  return success({ id: expense.id }, "Expense recorded.");
}

export async function updateExpense(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("expenses:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = expenseUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Invalid data", parsed.error.flatten().fieldErrors);
  const { id, ...rest } = parsed.data;

  const target = await prisma.expense.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Expense not found.");
  if (target.status === "APPROVED") return failure("Approved expense cannot be modified.");

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
  return success({ id }, "Expense updated.");
}

export async function decideExpense(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("expenses:approve");
  if (!me.companyId) return failure("You are not assigned to a company.");
  const parsed = expenseDecisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Invalid data", parsed.error.flatten().fieldErrors);
  const { id, decision } = parsed.data;

  const target = await prisma.expense.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Expense not found.");

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

  // Fetch driver / truck / load for rich decision body
  const [decDriver, decTruck, decLoad] = await Promise.all([
    target.driverId
      ? prisma.driverProfile.findUnique({
          where: { id: target.driverId },
          select: { firstName: true, lastName: true },
        })
      : null,
    target.truckId
      ? prisma.truck.findUnique({ where: { id: target.truckId }, select: { plateNumber: true } })
      : null,
    target.loadId
      ? prisma.load.findUnique({
          where: { id: target.loadId },
          select: { referenceNumber: true },
        })
      : null,
  ]);

  const decBodyLines: string[] = [
    `Type: ${target.type} | Amount: ${target.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${target.currency}`,
  ];
  if (decDriver)
    decBodyLines.push(
      `Driver: ${decDriver.firstName} ${decDriver.lastName}${
        decTruck ? ` | Truck: ${decTruck.plateNumber}` : ""
      }`,
    );
  else if (decTruck) decBodyLines.push(`Truck: ${decTruck.plateNumber}`);
  if (decLoad) decBodyLines.push(`Load: ${decLoad.referenceNumber}`);

  await notifyEvent({
    companyId: me.companyId,
    topic: "expenses",
    type: "EXPENSE_DECISION",
    title: `${
      decision === "APPROVED" ? "✅ Expense approved" : "❌ Expense rejected"
    }: ${target.type}`,
    body: decBodyLines.join("\n"),
    link: `/accounting/expenses`,
    roles: ["COMPANY_ADMIN", "ACCOUNTANT"],
    userIds: target.reportedById ? [target.reportedById] : [],
  });

  revalidatePath("/accounting/expenses");
  return success({ id }, decision === "APPROVED" ? "Expense approved." : "Expense rejected.");
}

export async function deleteExpense(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("expenses:write");
  if (!me.companyId) return failure("You are not assigned to a company.");
  const id = String(formData.get("id") ?? "");
  if (!id) return failure("ID is missing.");

  const target = await prisma.expense.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Expense not found.");
  if (target.status === "APPROVED") return failure("Approved expense cannot be deleted.");

  await prisma.expense.delete({ where: { id } });
  await logAudit({
    action: "expense.delete",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Expense",
    entityId: id,
  });
  revalidatePath("/accounting/expenses");
  return success(null, "Expense deleted.");
}
