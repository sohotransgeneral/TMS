"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { userCreateSchema, userUpdateSchema } from "@/lib/validators/user";

export async function createUser(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("users:write");

  const raw = Object.fromEntries(formData);
  // Super admin can pick any company via the form; others are locked to their own
  const targetCompanyId =
    me.role === "SUPER_ADMIN"
      ? (typeof raw.companyId === "string" && raw.companyId ? raw.companyId : null)
      : me.companyId;

  if (!targetCompanyId) return failure("Selectează o companie.");

  const parsed = userCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return failure("Date invalide", parsed.error.flatten().fieldErrors);
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return failure("Există deja un utilizator cu acest email.");

  const hashed = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      phone: parsed.data.phone,
      role: parsed.data.role,
      active: parsed.data.active,
      password: hashed,
      companyId: targetCompanyId,
    },
  });

  await logAudit({
    action: "user.create",
    userId: me.id,
    companyId: targetCompanyId,
    entityType: "User",
    entityId: user.id,
  });

  revalidatePath("/admin/users");
  return success({ id: user.id }, "Utilizator creat.");
}

export async function updateUser(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("users:write");

  const parsed = userUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Date invalide", parsed.error.flatten().fieldErrors);
  }
  const { id, password, email, ...rest } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return failure("Utilizator inexistent.");

  // Non-super-admin can only edit users in their own company
  if (me.role !== "SUPER_ADMIN" && target.companyId !== me.companyId) {
    return failure("Utilizator inexistent.");
  }

  const data: Prisma.UserUpdateInput = { ...rest };
  if (email && email.toLowerCase() !== target.email) {
    data.email = email.toLowerCase();
  }
  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  await prisma.user.update({ where: { id }, data });

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
    return failure("Nu te poți dezactiva pe tine.");
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
  if (target.id === me.id) return failure("Nu te poți șterge pe tine.");

  await prisma.user.delete({ where: { id } });

  await logAudit({
    action: "user.delete",
    userId: me.id,
    companyId: target.companyId ?? me.companyId,
    entityType: "User",
    entityId: id,
  });

  revalidatePath("/admin/users");
  return success(undefined, "Utilizator șters.");
}
