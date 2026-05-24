"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { failure, success, type ActionResult } from "@/lib/action-helpers";

export async function createDriverAdjustment(
  formData: FormData,
): Promise<ActionResult> {
  const me = await requirePermission("drivers:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const driverProfileId = String(formData.get("driverProfileId") ?? "");
  const periodKey = String(formData.get("periodKey") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const rawAmount = parseFloat(String(formData.get("amount") ?? "0"));
  const sign = formData.get("sign") === "deduction" ? -1 : 1;
  const proofUrl = String(formData.get("proofUrl") ?? "").trim() || null;

  if (!driverProfileId) return failure("Driver is missing.");
  if (!periodKey) return failure("Period is missing.");
  if (!label) return failure("Label is required.");
  if (isNaN(rawAmount) || rawAmount <= 0) return failure("Amount must be positive.");

  // Verify driver belongs to this company
  const driver = await prisma.driverProfile.findFirst({
    where: { id: driverProfileId, companyId: me.companyId },
  });
  if (!driver) return failure("Driver not found.");

  const amount = sign * Math.abs(rawAmount);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).driverAdjustment.create({
    data: {
      companyId: me.companyId,
      driverProfileId,
      periodKey,
      label,
      amount,
      proofUrl,
    },
  });

  revalidatePath(`/admin/drivers/${driverProfileId}`);
  return success(null, "Adjustment added.");
}

export async function deleteDriverAdjustment(
  formData: FormData,
): Promise<ActionResult> {
  const me = await requirePermission("drivers:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const id = String(formData.get("id") ?? "");
  if (!id) return failure("ID is missing.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adj = await (prisma as any).driverAdjustment.findUnique({ where: { id } });
  if (!adj || adj.companyId !== me.companyId) return failure("Adjustment not found.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).driverAdjustment.delete({ where: { id } });
  revalidatePath(`/admin/drivers/${adj.driverProfileId}`);
  return success(null, "Adjustment deleted.");
}
