"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import {
  invoiceCreateSchema,
  invoiceUpdateSchema,
  invoiceStatusSchema,
  type InvoiceItem,
} from "@/lib/validators/accounting";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { notifyEvent } from "@/lib/notifications";

/** Pulls parallel `items[i][description|quantity|unitPrice]` arrays out of FormData. */
function parseItems(fd: FormData): InvoiceItem[] {
  const descs = fd.getAll("itemDescription").map((v) => String(v));
  const qtys = fd.getAll("itemQuantity").map((v) => String(v));
  const prices = fd.getAll("itemUnitPrice").map((v) => String(v));
  const items: InvoiceItem[] = [];
  for (let i = 0; i < descs.length; i++) {
    const description = (descs[i] ?? "").trim();
    if (!description) continue;
    items.push({
      description,
      quantity: Number(qtys[i] ?? 0),
      unitPrice: Number(prices[i] ?? 0),
    });
  }
  return items;
}

function totalsOf(items: InvoiceItem[], vatRate: number) {
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const vatAmount = +(subtotal * (vatRate / 100)).toFixed(2);
  const total = +(subtotal + vatAmount).toFixed(2);
  return { subtotal: +subtotal.toFixed(2), vatAmount, total };
}

export async function createInvoice(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("invoices:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const items = parseItems(formData);
  const raw = Object.fromEntries(formData);
  const parsed = invoiceCreateSchema.safeParse({ ...raw, items });
  if (!parsed.success) return failure("Invalid data", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const { subtotal, vatAmount, total } = totalsOf(d.items, d.vatRate);
  const { number, series } = await nextInvoiceNumber(me.companyId);

  const invoice = await prisma.invoice.create({
    data: {
      companyId: me.companyId,
      number,
      series: d.series ?? series,
      issueDate: d.issueDate,
      dueDate: d.dueDate,
      customerId: d.customerId,
      loadId: d.loadId || null,
      subtotal,
      vatRate: d.vatRate,
      vatAmount,
      total,
      currency: d.currency,
      notes: d.notes,
      items: d.items as never,
      status: "DRAFT",
    },
  });

  await logAudit({
    action: "invoice.create",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Invoice",
    entityId: invoice.id,
    meta: { number, total },
  });

  await notifyEvent({
    companyId: me.companyId,
    topic: "invoices",
    type: "INVOICE_CREATED",
    title: `Invoice ${number} created`,
    body: `Total ${total} ${d.currency}`,
    link: `/accounting/invoices/${invoice.id}`,
    roles: ["COMPANY_ADMIN", "ACCOUNTANT"],
    userIds: [me.id],
  });

  revalidatePath("/accounting/invoices");
  return success({ id: invoice.id, number }, `Invoice ${number} created.`);
}

export async function updateInvoice(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("invoices:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const items = parseItems(formData);
  const raw = Object.fromEntries(formData);
  const parsed = invoiceUpdateSchema.safeParse({ ...raw, items: items.length ? items : undefined });
  if (!parsed.success) return failure("Invalid data", parsed.error.flatten().fieldErrors);

  const { id, items: newItems, ...rest } = parsed.data;
  const target = await prisma.invoice.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Invoice not found.");
  if (target.status === "PAID" || target.status === "CANCELLED")
    return failure("Invoice can no longer be modified.");

  const data: Record<string, unknown> = { ...rest };
  if (newItems && newItems.length) {
    const vatRate = rest.vatRate ?? target.vatRate;
    const t = totalsOf(newItems, vatRate);
    data.items = newItems as never;
    data.subtotal = t.subtotal;
    data.vatAmount = t.vatAmount;
    data.total = t.total;
  }
  if (rest.loadId !== undefined) data.loadId = rest.loadId || null;

  await prisma.invoice.update({ where: { id }, data });

  await logAudit({
    action: "invoice.update",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Invoice",
    entityId: id,
  });

  revalidatePath("/accounting/invoices");
  revalidatePath(`/accounting/invoices/${id}`);
  return success({ id }, "Invoice updated.");
}

export async function changeInvoiceStatus(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("invoices:write");
  if (!me.companyId) return failure("You are not assigned to a company.");
  const parsed = invoiceStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Invalid data", parsed.error.flatten().fieldErrors);
  const { id, status } = parsed.data;

  const target = await prisma.invoice.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Invoice not found.");

  await prisma.invoice.update({ where: { id }, data: { status } });

  await logAudit({
    action: "invoice.status_change",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Invoice",
    entityId: id,
    meta: { from: target.status, to: status },
  });

  revalidatePath("/accounting/invoices");
  revalidatePath(`/accounting/invoices/${id}`);
  return success({ id }, "Status actualizat.");
}

export async function deleteInvoice(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("invoices:write");
  if (!me.companyId) return failure("You are not assigned to a company.");
  const id = String(formData.get("id") ?? "");
  if (!id) return failure("ID is missing.");

  const target = await prisma.invoice.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) return failure("Invoice not found.");
  if (target.status !== "DRAFT" && target.status !== "CANCELLED")
    return failure("Only DRAFT/Canceled invoices can be deleted.");
  if (target.paidAmount > 0) return failure("Payments exist; cannot delete.");

  await prisma.invoice.delete({ where: { id } });
  await logAudit({
    action: "invoice.delete",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Invoice",
    entityId: id,
  });
  revalidatePath("/accounting/invoices");
  redirect("/accounting/invoices");
}
