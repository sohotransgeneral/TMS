"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { canActOnCompany, failure, success, type ActionResult } from "@/lib/action-helpers";

/**
 * Marks a dispatcher's commission on one load as paid or unpaid.
 *
 * Tracked per load rather than per period because that is how the money moves:
 * a payout run covers whichever loads were settled, and the ones that came in
 * afterwards stay outstanding without anyone having to remember a cut-off date.
 */
export async function setLoadCommissionPaid(
  loadId: string,
  paid: boolean,
): Promise<ActionResult> {
  const me = await requirePermission("users:write");

  const load = await prisma.load.findUnique({
    where: { id: loadId },
    select: { companyId: true, referenceNumber: true, dispatcherId: true },
  });
  if (!load || !canActOnCompany(me, load.companyId)) return failure("Load not found.");

  await prisma.load.update({
    where: { id: loadId },
    data: { dispatcherPaidAt: paid ? new Date() : null },
  });

  if (load.dispatcherId) revalidatePath(`/admin/dispatchers/${load.dispatcherId}`);
  revalidatePath("/admin/dispatchers");
  return success(
    null,
    paid
      ? `Load ${load.referenceNumber} marked as paid.`
      : `Load ${load.referenceNumber} moved back to unpaid.`,
  );
}

/**
 * Settles everything currently outstanding for a dispatcher in one period —
 * the "everything up to now has been paid" case.
 *
 * The caller passes the loads it is showing, so what gets settled is exactly
 * what was on screen. Deriving the list again here could quietly settle a load
 * that arrived between the page rendering and the button being pressed.
 */
export async function markCommissionPaid(
  dispatcherId: string,
  loadIds: string[],
  paid: boolean,
): Promise<ActionResult> {
  const me = await requirePermission("users:write");
  if (loadIds.length === 0) return failure("Nothing to settle.");

  const loads = await prisma.load.findMany({
    where: { id: { in: loadIds }, dispatcherId },
    select: { id: true, companyId: true },
  });
  const allowed = loads.filter((l) => canActOnCompany(me, l.companyId));
  if (allowed.length === 0) return failure("No matching loads.");

  const { count } = await prisma.load.updateMany({
    where: { id: { in: allowed.map((l) => l.id) } },
    data: { dispatcherPaidAt: paid ? new Date() : null },
  });

  revalidatePath(`/admin/dispatchers/${dispatcherId}`);
  revalidatePath("/admin/dispatchers");
  return success(
    null,
    paid
      ? `${count} load${count === 1 ? "" : "s"} marked as paid.`
      : `${count} load${count === 1 ? "" : "s"} moved back to unpaid.`,
  );
}
