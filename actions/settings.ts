"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional().or(z.literal("").transform(() => undefined)),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const me = await requireUser();

  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  const email = parsed.data.email.toLowerCase();
  if (email !== me.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return failure("This email is already in use.");
  }

  await prisma.user.update({
    where: { id: me.id },
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone ?? null,
    },
  });

  await logAudit({
    action: "user.update",
    userId: me.id,
    companyId: me.companyId,
    entityType: "User",
    entityId: me.id,
    meta: { self: true },
  });

  revalidatePath("/settings");
  return success(undefined, "Profile updated.");
}

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const me = await requireUser();

  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Invalid data", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user?.password) return failure("Password change not available for this account.");

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!ok) return failure("Current password is incorrect.");

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: me.id }, data: { password: hashed } });

  await logAudit({
    action: "user.password_change",
    userId: me.id,
    companyId: me.companyId,
    entityType: "User",
    entityId: me.id,
  });

  return success(undefined, "Password changed successfully.");
}
