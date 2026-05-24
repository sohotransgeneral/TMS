"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { customerSchema, customerUpdateSchema } from "@/lib/validators/customer";

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("customers:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
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
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = customerUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
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
    return failure("The customer has linked loads or invoices and cannot be deleted.");
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
  return success(undefined, "Customer deleted.");
}

/** Set or reset the portal password for a customer's linked User account.
 *  If no User is linked yet, creates one (requires the customer to have an email). */
export async function setCustomerPortalPassword(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("customers:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const customerId = formData.get("customerId") as string | null;
  const password = formData.get("password") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;

  if (!customerId) return failure("Customer ID missing.");
  if (!password || password.length < 8) return failure("Password must be at least 8 characters.");
  if (password !== confirmPassword) return failure("Passwords do not match.");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: me.companyId },
    include: { user: true },
  });
  if (!customer) return failure("Customer not found.");

  const hashed = await bcrypt.hash(password, 10);

  if (customer.userId && customer.user) {
    // Update existing portal user's password (and make sure they're active)
    await prisma.user.update({
      where: { id: customer.userId },
      data: { password: hashed, active: true },
    });
  } else {
    // Create a new portal user linked to this customer
    const email = customer.email?.toLowerCase();
    if (!email) return failure("Customer must have an email address to create a portal account.");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Re-use existing user, just set password and link
      await prisma.user.update({ where: { id: existing.id }, data: { password: hashed, active: true } });
      await prisma.customer.update({ where: { id: customerId }, data: { userId: existing.id } });
    } else {
      const newUser = await prisma.user.create({
        data: {
          email,
          name: customer.contactPerson ?? customer.name,
          role: "CUSTOMER",
          active: true,
          password: hashed,
          companyId: me.companyId,
        },
      });
      await prisma.customer.update({ where: { id: customerId }, data: { userId: newUser.id } });
    }
  }

  await logAudit({
    action: "customer.portal_password",
    userId: me.id,
    companyId: me.companyId,
    entityType: "Customer",
    entityId: customerId,
  });

  revalidatePath("/customers");
  return success(undefined, "Portal access set. Customer can now log in.");
}
