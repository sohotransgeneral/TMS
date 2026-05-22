"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { driverCreateSchema, driverUpdateSchema } from "@/lib/validators/driver";

export async function createDriver(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("drivers:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  // Convert FormData (licenseCategories may come as comma-separated)
  const raw = Object.fromEntries(formData);
  const parsed = driverCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return failure("Date invalide", parsed.error.flatten().fieldErrors);
  }
  const d = parsed.data;
  const email = d.email.toLowerCase();

  if (await prisma.user.findUnique({ where: { email } })) {
    return failure("Există deja un cont cu acest email.");
  }

  const hashed = await bcrypt.hash(d.password, 10);

  const newUser = await prisma.user.create({
    data: {
      email,
      name: `${d.firstName} ${d.lastName}`,
      phone: d.phone,
      role: "DRIVER" as const,
      active: true,
      password: hashed,
      companyId: me.companyId,
    },
  });

  const driver = await prisma.driverProfile.create({
    data: {
      companyId: me.companyId,
      userId: newUser.id,
      firstName: d.firstName,
      lastName: d.lastName,
      cnp: d.cnp,
      dateOfBirth: d.dateOfBirth,
      licenseNumber: d.licenseNumber,
      licenseCategories: d.licenseCategories ?? [],
      licenseIssuedAt: d.licenseIssuedAt,
      licenseExpiresAt: d.licenseExpiresAt,
      tachoCardNumber: d.tachoCardNumber,
      tachoCardExpiresAt: d.tachoCardExpiresAt,
      employedSince: d.employedSince,
      salaryPerKm: d.salaryPerKm,
      commissionRate: d.commissionRate,
      status: d.status,
      internalNotes: d.internalNotes,
    },
  });

  await logAudit({
    action: "driver.create",
    userId: me.id,
    companyId: me.companyId,
    entityType: "DriverProfile",
    entityId: driver.id,
  });

  revalidatePath("/admin/drivers");
  return success({ id: driver.id }, "Șofer creat.");
}

export async function updateDriver(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("drivers:write");
  if (!me.companyId) return failure("Nu ești asociat unei companii.");

  const parsed = driverUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Date invalide", parsed.error.flatten().fieldErrors);
  }
  const { id, password, email, phone, firstName, lastName, ...rest } = parsed.data;

  const target = await prisma.driverProfile.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!target || target.companyId !== me.companyId) {
    return failure("Șofer inexistent.");
  }

  await prisma.driverProfile.update({
    where: { id },
    data: {
      firstName: firstName ?? target.firstName,
      lastName: lastName ?? target.lastName,
      ...rest,
    },
  });

  // Sync user
  const userUpdate: Record<string, unknown> = {
    name: `${firstName ?? target.firstName} ${lastName ?? target.lastName}`,
  };
  if (phone !== undefined) userUpdate.phone = phone;
  if (email && email.toLowerCase() !== target.user.email) {
    userUpdate.email = email.toLowerCase();
  }
  if (password) {
    userUpdate.password = await bcrypt.hash(password, 10);
  }
  await prisma.user.update({ where: { id: target.userId }, data: userUpdate });

  await logAudit({
    action: "driver.update",
    userId: me.id,
    companyId: me.companyId,
    entityType: "DriverProfile",
    entityId: id,
  });

  revalidatePath("/admin/drivers");
  return success(undefined, "Șofer actualizat.");
}

export async function deleteDriver(id: string): Promise<ActionResult> {
  const me = await requirePermission("drivers:write");
  const target = await prisma.driverProfile.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) {
    return failure("Șofer inexistent.");
  }

  // Delete driver profile + linked user; loads keep historic reference via SetNull
  await prisma.driverProfile.delete({ where: { id } });
  await prisma.user.delete({ where: { id: target.userId } }).catch(() => undefined);

  await logAudit({
    action: "driver.delete",
    userId: me.id,
    companyId: me.companyId,
    entityType: "DriverProfile",
    entityId: id,
  });

  revalidatePath("/admin/drivers");
  return success(undefined, "Șofer șters.");
}
