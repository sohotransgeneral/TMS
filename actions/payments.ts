"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { paymentCreateSchema } from "@/lib/validators/accounting";

export async function recordPayment(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("payments:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const parsed = paymentCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Date invalide", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const invoice = await prisma.invoice.findUnique({ where: { id: d.invoiceId } });
  if (!invoice || invoice.companyId !== me.companyId) return failure("Factură inexistentă.");
  if (invoice.status === "CANCELLED") return failure("Factura este anulată.");

  const newPaid = +(invoice.paidAmount + d.amount).toFixed(2);
  const status = newPaid + 0.005 >= invoice.total ? "PAID" : invoice.status === "DRAFT" ? "SENT" : invoice.status;

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        companyId: me.companyId,
        invoiceId: d.invoiceId,
        amount: d.amount,
        currency: d.currency,
        method: d.method,
        reference: d.reference,
        paidAt: d.paidAt,
        notes: d.notes,
      },
    }),
    prisma.invoice.update({
      where: { id: d.invoiceId },
      data: { paidAmount: newPaid, status },
    }),
  ]);

  await logAudit({
    action: "payment.record",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Invoice",
    entityId: d.invoiceId,
    meta: { amount: d.amount, newPaid },
  });

  revalidatePath("/accounting/invoices");
  revalidatePath(`/accounting/invoices/${d.invoiceId}`);
  return success(null, "Plată înregistrată.");
}

export async function deletePayment(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("payments:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");
  const id = String(formData.get("id") ?? "");
  if (!id) return failure("ID lipsă.");

  const pay = await prisma.payment.findUnique({ where: { id } });
  if (!pay || pay.companyId !== me.companyId) return failure("Plată inexistentă.");

  const invoice = await prisma.invoice.findUnique({ where: { id: pay.invoiceId } });
  if (!invoice) return failure("Factură inexistentă.");

  const newPaid = +(invoice.paidAmount - pay.amount).toFixed(2);
  const status = newPaid <= 0 ? "SENT" : invoice.status === "PAID" ? "SENT" : invoice.status;

  await prisma.$transaction([
    prisma.payment.delete({ where: { id } }),
    prisma.invoice.update({
      where: { id: pay.invoiceId },
      data: { paidAmount: newPaid < 0 ? 0 : newPaid, status },
    }),
  ]);

  await logAudit({
    action: "payment.delete",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Invoice",
    entityId: pay.invoiceId,
  });

  revalidatePath(`/accounting/invoices/${pay.invoiceId}`);
  return success(null, "Plată ștearsă.");
}
