"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma, DriverStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { userCreateSchema, userUpdateSchema } from "@/lib/validators/user";
import { notifyEvent } from "@/lib/notifications";

export async function createUser(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("users:write");

  const raw = Object.fromEntries(formData);
  // Super admin can pick any company via the form; others are locked to their own
  const targetCompanyId =
    me.role === "SUPER_ADMIN"
      ? (typeof raw.companyId === "string" && raw.companyId ? raw.companyId : null)
      : me.companyId;

  // companyId is optional — SUPER_ADMIN can create users without a company

  const parsed = userCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return failure("A user with this email already exists.");

  const hashed = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      phone: parsed.data.phone,
      telegramChatId: parsed.data.telegramChatId ?? null,
      role: parsed.data.role,
      active: parsed.data.active,
      password: hashed,
      companyId: targetCompanyId,
    },
  });

  // If CUSTOMER role and a customerId was provided, link this user to that Customer
  const rawCustomerId = typeof raw.customerId === "string" ? raw.customerId.trim() : "";
  if (parsed.data.role === "CUSTOMER" && rawCustomerId) {
    const customerToLink = await prisma.customer.findFirst({
      where: { id: rawCustomerId, companyId: targetCompanyId ?? undefined },
      select: { id: true, userId: true },
    });
    if (customerToLink && (customerToLink.userId === null || customerToLink.userId === user.id)) {
      await prisma.customer.update({
        where: { id: rawCustomerId },
        data: { userId: user.id },
      });
    }
  }

  // If DRIVER role, create DriverProfile from form data
  if (parsed.data.role === "DRIVER" && targetCompanyId) {
    const firstName = (typeof raw.firstName === "string" ? raw.firstName : "").trim();
    const lastName  = (typeof raw.lastName  === "string" ? raw.lastName  : "").trim();
    const toDate = (v: unknown) => {
      if (!v || typeof v !== "string" || !v.trim()) return null;
      const d = new Date(v); return isNaN(d.getTime()) ? null : d;
    };
    const toNum = (v: unknown) => {
      const n = parseFloat(String(v ?? ""));
      return isNaN(n) ? null : n;
    };
    const cats = typeof raw.licenseCategories === "string" && raw.licenseCategories.trim()
      ? raw.licenseCategories.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
    await prisma.driverProfile.create({
      data: {
        companyId: targetCompanyId,
        userId: user.id,
        firstName: firstName || (parsed.data.name?.split(" ")[0] ?? ""),
        lastName:  lastName  || (parsed.data.name?.split(" ").slice(1).join(" ") ?? ""),
        cnp: typeof raw.cnp === "string" && raw.cnp.trim() ? raw.cnp.trim() : null,
        licenseNumber: typeof raw.licenseNumber === "string" && raw.licenseNumber.trim() ? raw.licenseNumber.trim() : null,
        licenseCategories: cats,
        licenseIssuedAt: toDate(raw.licenseIssuedAt),
        licenseExpiresAt: toDate(raw.licenseExpiresAt),
        tachoCardNumber: typeof raw.tachoCardNumber === "string" && raw.tachoCardNumber.trim() ? raw.tachoCardNumber.trim() : null,
        tachoCardExpiresAt: toDate(raw.tachoCardExpiresAt),
        status: (typeof raw.driverStatus === "string" && raw.driverStatus) ? raw.driverStatus as DriverStatus : DriverStatus.AVAILABLE,
        salaryType: typeof raw.salaryType === "string" && raw.salaryType ? raw.salaryType : "PER_MI",
        salaryPerKm: toNum(raw.salaryPerKm),
        salaryFixedAmount: toNum(raw.salaryFixedAmount),
        grossPercent: toNum(raw.grossPercent),
        commissionRate: toNum(raw.commissionRate),
        taxCas: toNum(raw.taxCas),
        taxCass: toNum(raw.taxCass),
        taxImpozit: toNum(raw.taxImpozit),
        internalNotes: typeof raw.internalNotes === "string" && raw.internalNotes.trim() ? raw.internalNotes.trim() : null,
        truckId: typeof raw.driverTruckId === "string" && raw.driverTruckId ? raw.driverTruckId : null,
        trailerId: typeof raw.driverTrailerId === "string" && raw.driverTrailerId ? raw.driverTrailerId : null,
      },
    });
    revalidatePath("/admin/drivers");
  }

  await logAudit({
    action: "user.create",
    userId: me.id,
    companyId: targetCompanyId,
    entityType: "User",
    entityId: user.id,
  });

  if (targetCompanyId) {
    await notifyEvent({
      companyId: targetCompanyId,
      topic: "users",
      type: "USER_CREATED",
      title: `New user: ${user.name}`,
      body: `${user.email} · ${user.role}`,
      link: `/admin/users`,
      roles: ["COMPANY_ADMIN"],
    });
  }

  revalidatePath("/admin/users");
  return success({ id: user.id }, "Utilizator creat.");
}

export async function updateUser(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("users:write");

  const parsed = userUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors);
  }
  const { id, password, email, telegramChatId, ...rest } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return failure("Utilizator inexistent.");

  // Non-super-admin can only edit users in their own company
  if (me.role !== "SUPER_ADMIN" && target.companyId !== me.companyId) {
    return failure("Utilizator inexistent.");
  }

  const data: Prisma.UserUpdateInput = { ...rest };
  // Always allow clearing telegram chat id by submitting empty
  data.telegramChatId = telegramChatId ?? null;
  if (email && email.toLowerCase() !== target.email) {
    data.email = email.toLowerCase();
  }
  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  await prisma.user.update({ where: { id }, data });

  // Re-link / unlink customer profile when role is CUSTOMER
  const rawCustomerId =
    typeof formData.get("customerId") === "string"
      ? (formData.get("customerId") as string).trim()
      : "";

  if (parsed.data.role === "CUSTOMER") {
    // Unlink any customer currently linked to this user
    await prisma.customer.updateMany({
      where: { userId: id },
      data: { userId: null },
    });
    // Link new customer if one was selected
    if (rawCustomerId) {
      // Verify the customer belongs to the same company and is not linked to another user
      const customerToLink = await prisma.customer.findFirst({
        where: { id: rawCustomerId, companyId: target.companyId ?? undefined },
        select: { id: true, userId: true },
      });
      if (customerToLink && (customerToLink.userId === null || customerToLink.userId === id)) {
        await prisma.customer.update({
          where: { id: rawCustomerId },
          data: { userId: id },
        });
      }
    }
  }

  // Upsert DriverProfile when role is DRIVER
  if (parsed.data.role === "DRIVER" && target.companyId) {
    const raw = Object.fromEntries(formData);
    const toDate = (v: unknown) => {
      if (!v || typeof v !== "string" || !v.trim()) return null;
      const d = new Date(v); return isNaN(d.getTime()) ? null : d;
    };
    const toNum = (v: unknown) => {
      const n = parseFloat(String(v ?? ""));
      return isNaN(n) ? null : n;
    };
    const cats = typeof raw.licenseCategories === "string" && raw.licenseCategories.trim()
      ? raw.licenseCategories.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
    const firstName = (typeof raw.firstName === "string" ? raw.firstName : "").trim();
    const lastName  = (typeof raw.lastName  === "string" ? raw.lastName  : "").trim();
    const driverData = {
      companyId: target.companyId,
      userId: id,
      firstName: firstName || target.name?.split(" ")[0] || "",
      lastName:  lastName  || target.name?.split(" ").slice(1).join(" ") || "",
      cnp: typeof raw.cnp === "string" && raw.cnp.trim() ? raw.cnp.trim() : null,
      licenseNumber: typeof raw.licenseNumber === "string" && raw.licenseNumber.trim() ? raw.licenseNumber.trim() : null,
      licenseCategories: cats,
      licenseIssuedAt: toDate(raw.licenseIssuedAt),
      licenseExpiresAt: toDate(raw.licenseExpiresAt),
      tachoCardNumber: typeof raw.tachoCardNumber === "string" && raw.tachoCardNumber.trim() ? raw.tachoCardNumber.trim() : null,
      tachoCardExpiresAt: toDate(raw.tachoCardExpiresAt),
      status: (typeof raw.driverStatus === "string" && raw.driverStatus) ? raw.driverStatus as DriverStatus : DriverStatus.AVAILABLE,
      salaryType: typeof raw.salaryType === "string" && raw.salaryType ? raw.salaryType : "PER_MI",
      salaryPerKm: toNum(raw.salaryPerKm),
      salaryFixedAmount: toNum(raw.salaryFixedAmount),
      grossPercent: toNum(raw.grossPercent),
      commissionRate: toNum(raw.commissionRate),
      taxCas: toNum(raw.taxCas),
      taxCass: toNum(raw.taxCass),
      taxImpozit: toNum(raw.taxImpozit),
      internalNotes: typeof raw.internalNotes === "string" && raw.internalNotes.trim() ? raw.internalNotes.trim() : null,
      truckId: typeof raw.driverTruckId === "string" && raw.driverTruckId ? raw.driverTruckId : null,
      trailerId: typeof raw.driverTrailerId === "string" && raw.driverTrailerId ? raw.driverTrailerId : null,
    };
    await prisma.driverProfile.upsert({
      where: { userId: id },
      create: driverData,
      update: driverData,
    });
    revalidatePath("/admin/drivers");
  }

  await logAudit({
    action: "user.update",
    userId: me.id,
    companyId: target.companyId ?? me.companyId,
    entityType: "User",
    entityId: id,
  });

  revalidatePath("/admin/users");
  return success(undefined, "Utilizator actualizat.");
}

export async function toggleUserActive(id: string): Promise<ActionResult> {
  const me = await requirePermission("users:write");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return failure("Utilizator inexistent.");
  if (me.role !== "SUPER_ADMIN" && target.companyId !== me.companyId) {
    return failure("Utilizator inexistent.");
  }
  if (target.id === me.id) {
    return failure("You cannot deactivate yourself.");
  }

  await prisma.user.update({
    where: { id },
    data: { active: !target.active },
  });

  await logAudit({
    action: target.active ? "user.deactivate" : "user.activate",
    userId: me.id,
    companyId: target.companyId ?? me.companyId,
    entityType: "User",
    entityId: id,
  });

  revalidatePath("/admin/users");
  return success(undefined, target.active ? "Utilizator dezactivat." : "Utilizator activat.");
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const me = await requirePermission("users:write");
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return failure("Utilizator inexistent.");
  if (me.role !== "SUPER_ADMIN" && target.companyId !== me.companyId) {
    return failure("Utilizator inexistent.");
  }
  if (target.id === me.id) return failure("You cannot delete yourself.");

  await prisma.user.delete({ where: { id } });

  await logAudit({
    action: "user.delete",
    userId: me.id,
    companyId: target.companyId ?? me.companyId,
    entityType: "User",
    entityId: id,
  });

  revalidatePath("/admin/users");
  return success(undefined, "User deleted.");
}
