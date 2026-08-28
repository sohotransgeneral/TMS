"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { canActOnCompany, failure, success, type ActionResult } from "@/lib/action-helpers";

/**
 * Bonuses and deductions on a dispatcher's commission for one period.
 *
 * Stored against a periodKey rather than a date range so an adjustment stays
 * attached to the month or week it was agreed for, even when the report is
 * later viewed through a different period.
 */
export async function createDispatcherAdjustment(
  formData: FormData,
): Promise<ActionResult> {
  const me = await requirePermission("users:write");

  const userId = String(formData.get("userId") ?? "");
  const periodKey = String(formData.get("periodKey") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const rawAmount = parseFloat(String(formData.get("amount") ?? "0"));
  const sign = formData.get("sign") === "deduction" ? -1 : 1;
  const proofUrl = String(formData.get("proofUrl") ?? "").trim() || null;

  if (!userId) return failure("Dispatcher is missing.");
  if (!periodKey) return failure("Period is missing.");
  if (!label) return failure("Label is required.");
  if (isNaN(rawAmount) || rawAmount <= 0) return failure("Amount must be positive.");

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  });
  if (!target || !canActOnCompany(me, target.companyId)) {
    return failure("Dispatcher not found.");
  }
  if (!target.companyId) return failure("Dispatcher has no company.");

  await prisma.dispatcherAdjustment.create({
    data: {
      companyId: target.companyId,
      userId,
      periodKey,
      label,
      amount: sign * Math.abs(rawAmount),
      proofUrl,
    },
  });

  revalidatePath(`/admin/dispatchers/${userId}`);
  return success(null, "Adjustment added.");
}

export async function deleteDispatcherAdjustment(
  formData: FormData,
): Promise<ActionResult> {
  const me = await requirePermission("users:write");

  const id = String(formData.get("id") ?? "");
  if (!id) return failure("ID is missing.");

  const adj = await prisma.dispatcherAdjustment.findUnique({ where: { id } });
  if (!adj || !canActOnCompany(me, adj.companyId)) {
    return failure("Adjustment not found.");
  }

  await prisma.dispatcherAdjustment.delete({ where: { id } });
  revalidatePath(`/admin/dispatchers/${adj.userId}`);
  return success(null, "Adjustment deleted.");
}
