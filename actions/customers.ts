"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { customerSchema, customerUpdateSchema } from "@/lib/validators/customer";

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("customers:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Date invalide", parsed.error.flatten().fieldErrors);
  }

  const customer = await prisma.customer.create({
    data: { ...parsed.data, companyId: me.companyId },
  });

  await logAudit({
    action: "customer.create",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Customer",
    entityId: customer.id,
  });

  revalidatePath("/customers");
  return success({ id: customer.id }, "Client creat.");
}

export async function updateCustomer(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("customers:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const parsed = customerUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Date invalide", parsed.error.flatten().fieldErrors);
  }
  const { id, ...data } = parsed.data;

  const target = await prisma.customer.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) {
    return failure("Client inexistent.");
  }

  await prisma.customer.update({ where: { id }, data });

  await logAudit({
    action: "customer.update",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Customer",
    entityId: id,
  });

  revalidatePath("/customers");
  return success(undefined, "Client actualizat.");
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const me = await requirePermission("customers:write");
  const target = await prisma.customer.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) {
    return failure("Client inexistent.");
  }

  // Check for existing loads/invoices before destructive delete
  const [loads, invoices] = await Promise.all([
    prisma.load.count({ where: { customerId: id } }),
    prisma.invoice.count({ where: { customerId: id } }),
  ]);
  if (loads > 0 || invoices > 0) {
    return failure("Clientul are curse sau facturi asociate și nu poate fi șters.");
  }

  await prisma.customer.delete({ where: { id } });

  await logAudit({
    action: "customer.delete",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Customer",
    entityId: id,
  });

  revalidatePath("/customers");
  return success(undefined, "Client șters.");
}
