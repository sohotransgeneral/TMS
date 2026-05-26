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
  if (!me.companyId) return failure("You are not assigned to a company.");

  // Convert FormData (licenseCategories may come as comma-separated)
  const raw = Object.fromEntries(formData);
  const parsed = driverCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
  }
  const d = parsed.data;
  const email = d.email.toLowerCase();

  if (await prisma.user.findUnique({ where: { email } })) {
    return failure("An account with this email already exists.");
  }

  const hashed = await bcrypt.hash(d.password, 10);

  try {
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
        cnp: d.cnp ?? null,
        dateOfBirth: d.dateOfBirth ?? null,
        licenseNumber: d.licenseNumber ?? null,
        licenseCategories: d.licenseCategories ?? [],
        licenseIssuedAt: d.licenseIssuedAt ?? null,
        licenseExpiresAt: d.licenseExpiresAt ?? null,
        tachoCardNumber: d.tachoCardNumber ?? null,
        tachoCardExpiresAt: d.tachoCardExpiresAt ?? null,
        employedSince: d.employedSince ?? null,
        salaryType: d.salaryType ?? "PER_MI",
        salaryPerKm: d.salaryPerKm ?? null,
        salaryFixedAmount: d.salaryFixedAmount ?? null,
        grossPercent: d.grossPercent ?? null,
        commissionRate: d.commissionRate ?? null,
        taxCas: d.taxCas ?? null,
        taxCass: d.taxCass ?? null,
        taxImpozit: d.taxImpozit ?? null,
        status: d.status ?? "AVAILABLE",
        internalNotes: d.internalNotes ?? null,
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
    return success({ id: driver.id }, "Driver created.");
  } catch (err) {
    console.error("[createDriver] error:", err);
    return failure("Failed to create driver. Please try again.");
  }
}

export async function updateDriver(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("drivers:write");
  if (!me.companyId) return failure("You are not assigned to a company.");

  const parsed = driverUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    console.error("[updateDriver] Zod errors:", parsed.error.flatten());
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
  }
  const d = parsed.data;

  const target = await prisma.driverProfile.findUnique({
    where: { id: d.id },
    include: { user: true },
  });
  if (!target || target.companyId !== me.companyId) {
    return failure("Driver not found.");
  }

  try {
    await prisma.driverProfile.update({
      where: { id: d.id },
      data: {
        firstName: d.firstName ?? target.firstName,
        lastName: d.lastName ?? target.lastName,
        cnp: d.cnp ?? null,
        dateOfBirth: d.dateOfBirth ?? null,
        licenseNumber: d.licenseNumber ?? null,
        licenseCategories: d.licenseCategories ?? target.licenseCategories,
        licenseIssuedAt: d.licenseIssuedAt ?? null,
        licenseExpiresAt: d.licenseExpiresAt ?? null,
        tachoCardNumber: d.tachoCardNumber ?? null,
        tachoCardExpiresAt: d.tachoCardExpiresAt ?? null,
        employedSince: d.employedSince ?? null,
        status: d.status ?? target.status,
        salaryType: d.salaryType ?? target.salaryType,
        salaryPerKm: d.salaryPerKm ?? null,
        salaryFixedAmount: d.salaryFixedAmount ?? null,
        grossPercent: d.grossPercent ?? null,
        commissionRate: d.commissionRate ?? null,
        taxCas: d.taxCas ?? null,
        taxCass: d.taxCass ?? null,
        taxImpozit: d.taxImpozit ?? null,
        internalNotes: d.internalNotes ?? null,
      },
    });
  } catch (err) {
    console.error("[updateDriver] Prisma error:", err);
    return failure("Failed to save driver. Please try again.");
  }

  // Sync user
  const userUpdate: Record<string, unknown> = {
    name: `${d.firstName ?? target.firstName} ${d.lastName ?? target.lastName}`,
  };
  if (d.phone !== undefined) userUpdate.phone = d.phone ?? null;
  if (d.email && d.email.toLowerCase() !== target.user.email) {
    userUpdate.email = d.email.toLowerCase();
  }
  if (d.password) {
    userUpdate.password = await bcrypt.hash(d.password, 10);
  }
  try {
    await prisma.user.update({ where: { id: target.userId }, data: userUpdate });
  } catch (err) {
    console.error("[updateDriver] User sync error:", err);
  }

  await logAudit({
    action: "driver.update",
    userId: me.id,
    companyId: me.companyId,
    entityType: "DriverProfile",
    entityId: d.id,
  });

  revalidatePath("/admin/drivers");
  return success(undefined, "Driver updated.");
}

export async function deleteDriver(id: string): Promise<ActionResult> {
  const me = await requirePermission("drivers:write");
  const target = await prisma.driverProfile.findUnique({ where: { id } });
  if (!target || target.companyId !== me.companyId) {
    return failure("Driver not found.");
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
  return success(undefined, "Driver deleted.");
}
