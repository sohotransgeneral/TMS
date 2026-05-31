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

  // Fetch customer + optional load context for rich notification
  const [invCustomer, invLoad] = await Promise.all([
    prisma.customer.findUnique({ where: { id: d.customerId }, select: { name: true } }),
    d.loadId
      ? prisma.load.findUnique({
          where: { id: d.loadId },
          select: {
            referenceNumber: true,
            poNumber: true,
            driver: { select: { firstName: true, lastName: true } },
            truck: { select: { plateNumber: true } },
          },
        })
      : null,
  ]);

  const invBodyLines: string[] = [
    `Customer: ${invCustomer?.name ?? d.customerId}`,
  ];
  if (invLoad) {
    invBodyLines.push(
      `Load: ${invLoad.referenceNumber}${
        invLoad.poNumber ? ` (PO: ${invLoad.poNumber})` : ""
      }`,
    );
    if (invLoad.driver)
      invBodyLines.push(
        `Driver: ${invLoad.driver.firstName} ${invLoad.driver.lastName}${
          invLoad.truck ? ` | Truck: ${invLoad.truck.plateNumber}` : ""
        }`,
      );
  }
  invBodyLines.push(`Total: ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${d.currency}`);
  invBodyLines.push(`Due: ${d.dueDate instanceof Date ? d.dueDate.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : String(d.dueDate)}`);

  await notifyEvent({
    companyId: me.companyId,
    topic: "invoices",
    type: "INVOICE_CREATED",
    title: `🧾 Invoice ${number} created`,
    body: invBodyLines.join("\n"),
    link: `/accounting/invoices/${invoice.id}`,
    roles: ["COMPANY_ADMIN", "ACCOUNTANT"],
    userIds: [me.id],
  });

  revalidatePath("/accounting/invoices");
  return success({ id: invoice.id, number }, `Invoice ${number} created.`);
}

/**
 * One-click invoice creation from a load. Builds line items from the load's
 * price (+ accessorial), links it to the load, and flips the load status to
 * INVOICED. Requires the load to have a customer assigned.
 */
export async function createInvoiceFromLoad(
  loadId: string,
): Promise<ActionResult> {
  const me = await requirePermission("invoices:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const load = await prisma.load.findFirst({
    where: { id: loadId, companyId: me.companyId },
    include: { invoice: { select: { id: true } } },
  });
  if (!load) return failure("Load not found.");
  if (load.invoice) return failure("This load already has an invoice.");
  if (!load.customerId)
    return failure("Assign a Bill-to customer to the load before invoicing.");

  // Build line items from the load.
  const items: InvoiceItem[] = [];
  const route = [load.pickupCity, load.deliveryCity].filter(Boolean).join(" > ");
  items.push({
    description: route
      ? `Freight: ${route}`
      : `Freight \u2014 Load ${load.referenceNumber}`,
    quantity: 1,
    unitPrice: load.price ?? 0,
  });
  if (load.accessorialAmount && load.accessorialAmount > 0) {
    items.push({
      description: "Accessorials",
      quantity: 1,
      unitPrice: load.accessorialAmount,
    });
  }

  const { subtotal, vatAmount, total } = totalsOf(items, 0);
  const { number, series } = await nextInvoiceNumber(me.companyId);
  const issueDate = new Date();
  const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  const invoice = await prisma.invoice.create({
    data: {
      companyId: me.companyId,
      number,
      series: load.loadInvoiceNumber ?? series,
      issueDate,
      dueDate,
      customerId: load.customerId,
      loadId: load.id,
      subtotal,
      vatRate: 0,
      vatAmount,
      total,
      currency: load.currency ?? "USD",
      items: items as never,
      status: "DRAFT",
    },
  });

  // Flip the load to INVOICED + record status history.
  await prisma.load.update({
    where: { id: load.id },
    data: {
      status: "INVOICED",
      statusHistory: {
        create: {
          status: "INVOICED",
          changedById: me.id,
          note: `Invoice ${number} created`,
        },
      },
    },
  });

  await logAudit({
    action: "invoice.createFromLoad",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Invoice",
    entityId: invoice.id,
    meta: { number, total, loadId: load.id },
  });

  revalidatePath("/accounting/invoices");
  revalidatePath(`/dispatch/loads/${load.id}`);
  return success(
    { id: invoice.id, number },
    `Invoice ${number} created and load marked Invoiced.`,
  );
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
