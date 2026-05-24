"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { failure, success, type ActionResult } from "@/lib/action-helpers";

export async function createDriverAdjustment(
  formData: FormData,
): Promise<ActionResult> {
  const me = await requirePermission("drivers:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const driverProfileId = String(formData.get("driverProfileId") ?? "");
  const periodKey = String(formData.get("periodKey") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const rawAmount = parseFloat(String(formData.get("amount") ?? "0"));
  const sign = formData.get("sign") === "deduction" ? -1 : 1;
  const proofUrl = String(formData.get("proofUrl") ?? "").trim() || null;

  if (!driverProfileId) return failure("Driver lipsă.");
  if (!periodKey) return failure("Perioadă lipsă.");
  if (!label) return failure("Eticheta este obligatorie.");
  if (isNaN(rawAmount) || rawAmount <= 0) return failure("Suma trebuie să fie pozitivă.");

  // Verify driver belongs to this company
  const driver = await prisma.driverProfile.findFirst({
    where: { id: driverProfileId, companyId: me.companyId },
  });
  if (!driver) return failure("Driver inexistent.");

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
  return success(null, "Ajustare adăugată.");
}

export async function deleteDriverAdjustment(
  formData: FormData,
): Promise<ActionResult> {
  const me = await requirePermission("drivers:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const id = String(formData.get("id") ?? "");
  if (!id) return failure("ID lipsă.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adj = await (prisma as any).driverAdjustment.findUnique({ where: { id } });
  if (!adj || adj.companyId !== me.companyId) return failure("Ajustare inexistentă.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).driverAdjustment.delete({ where: { id } });
  revalidatePath(`/admin/drivers/${adj.driverProfileId}`);
  return success(null, "Ajustare ștearsă.");
}
