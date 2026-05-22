"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { failure, success, type ActionResult } from "@/lib/action-helpers";
import { companySchema } from "@/lib/validators/company";
import { z } from "zod";
import bcrypt from "bcryptjs";

export async function createCompany(formData: FormData): Promise<ActionResult> {
  const me = await requirePermission("company:write");
  if (me.role !== "SUPER_ADMIN") return failure("Access denied.");

  const raw = Object.fromEntries(formData);

  const adminSchema = z.object({
    adminName: z.string().min(2, "Admin name required"),
    adminEmail: z.string().email("Invalid email"),
    adminPassword: z.string().min(8, "At least 8 characters"),
  });

  const adminParsed = adminSchema.safeParse(raw);
  if (!adminParsed.success) {
    return failure("Invalid data", adminParsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  const companyParsed = companySchema.safeParse(raw);
  if (!companyParsed.success) {
    return failure("Invalid data", companyParsed.error.flatten().fieldErrors as Record<string, string[]>);
  }

  const existing = await prisma.user.findUnique({ where: { email: adminParsed.data.adminEmail.toLowerCase() } });
  if (existing) return failure("A user with this email already exists.");

  const hashed = await bcrypt.hash(adminParsed.data.adminPassword, 10);

  const company = await prisma.company.create({
    data: {
      ...companyParsed.data,
      subscriptionStatus: "ACTIVE",
      users: {
        create: {
          name: adminParsed.data.adminName,
          email: adminParsed.data.adminEmail.toLowerCase(),
          password: hashed,
          role: "COMPANY_ADMIN",
        },
      },
    },
  });

  await logAudit({
    action: "company.create",
    userId: me.id,
    companyId: company.id,
    entityType: "Company",
    entityId: company.id,
  });

  revalidatePath("/admin/company");
  return success({ id: company.id }, "Company created successfully.");
}

export async function updateMyCompany(formData: FormData): Promise<ActionResult> {
  const user = await requirePermission("company:write");
  if (!user.companyId) return failure("Nu ești asociat unei companii.");

  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return failure("Date invalide", parsed.error.flatten().fieldErrors);
  }

  await prisma.company.update({
    where: { id: user.companyId },
    data: parsed.data,
  });

  await logAudit({
    action: "company.update",
    userId: user.id,
    companyId: user.companyId,
    entityType: "Company",
    entityId: user.companyId,
  });

  revalidatePath("/admin/company");
  return success(undefined, "Modificările au fost salvate.");
}
