"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { paymentCreateSchema } from "@/lib/validators/accounting";
import { notifyEvent } from "@/lib/notifications";

export async function recordPayment(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("payments:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = paymentCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Invalid data", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const invoice = await prisma.invoice.findUnique({ where: { id: d.invoiceId } });
  if (!invoice || invoice.companyId !== me.companyId) return failure("Invoice not found.");
  if (invoice.status === "CANCELLED") return failure("Invoice is canceled.");

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

  // Fetch customer + load context
  const [payCustomer, payLoad] = await Promise.all([
    invoice.customerId
      ? prisma.customer.findUnique({ where: { id: invoice.customerId }, select: { name: true } })
      : null,
    invoice.loadId
      ? prisma.load.findUnique({
          where: { id: invoice.loadId },
          select: {
            referenceNumber: true,
            driver: { select: { firstName: true, lastName: true } },
            truck: { select: { plateNumber: true } },
          },
        })
      : null,
  ]);

  const payBodyLines: string[] = [
    `Customer: ${payCustomer?.name ?? (invoice as { customerName?: string | null }).customerName ?? invoice.customerId ?? "Unknown"}`,
  ];
  if (payLoad) {
    payBodyLines.push(`Load: ${payLoad.referenceNumber}`);
    if (payLoad.driver)
      payBodyLines.push(
        `Driver: ${payLoad.driver.firstName} ${payLoad.driver.lastName}${
          payLoad.truck ? ` | Truck: ${payLoad.truck.plateNumber}` : ""
        }`,
      );
  }
  payBodyLines.push(
    `Paid: ${d.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${d.currency} via ${d.method}`,
  );
  payBodyLines.push(
    `Total collected: ${newPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })} / ${invoice.total.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${invoice.currency}`,
  );
  if (d.reference) payBodyLines.push(`Ref: ${d.reference}`);

  await notifyEvent({
    companyId: me.companyId,
    topic: "invoices",
    type: status === "PAID" ? "INVOICE_PAID" : "INFO",
    title:
      status === "PAID"
        ? `✅ Invoice ${invoice.number} PAID`
        : `💰 Payment recorded — Invoice ${invoice.number}`,
    body: payBodyLines.join("\n"),
    link: `/accounting/invoices/${d.invoiceId}`,
    roles: ["COMPANY_ADMIN", "ACCOUNTANT"],
  });

  revalidatePath("/accounting/invoices");
  revalidatePath(`/accounting/invoices/${d.invoiceId}`);
  return success(null, "Payment recorded.");
}

export async function deletePayment(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("payments:write");
  if (!me.companyId) return failure("You are not assigned to a company.");
  const id = String(formData.get("id") ?? "");
  if (!id) return failure("ID is missing.");

  const pay = await prisma.payment.findUnique({ where: { id } });
  if (!pay || pay.companyId !== me.companyId) return failure("Payment not found.");

  const invoice = await prisma.invoice.findUnique({ where: { id: pay.invoiceId } });
  if (!invoice) return failure("Invoice not found.");

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
  return success(null, "Payment deleted.");
}
