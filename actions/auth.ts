"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";

import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { logAudit } from "@/lib/audit";
import { defaultDashboardFor } from "@/lib/permissions";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validators/auth";

export type ActionState =
  | { ok: true; message?: string; redirectTo?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
  | null;

// ------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------
export async function loginAction(
  _prev: ActionState,
  data: { email: string; password: string },
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: data.email ?? "",
    password: data.password ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid data",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: "Wrong email or password." };
    }
    throw err;
  }

  // Determine where to send the user.
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { role: true },
  });
  const redirectTo = user ? defaultDashboardFor(user.role) : "/dashboard";
  redirect(redirectTo);
}

// ------------------------------------------------------------
// REGISTER (creates a Company + COMPANY_ADMIN user)
// ------------------------------------------------------------
export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    companyName: formData.get("companyName") ?? "",
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid data",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const hashed = await bcrypt.hash(parsed.data.password, 10);

  const company = await prisma.company.create({
    data: {
      name: parsed.data.companyName,
      subscriptionStatus: "TRIAL",
      trialEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      users: {
        create: {
          email,
          name: parsed.data.name,
          password: hashed,
          role: "COMPANY_ADMIN",
        },
      },
    },
    include: { users: true },
  });

  const createdUser = company.users[0];
  await logAudit({
    action: "user.register",
    userId: createdUser.id,
    companyId: company.id,
    entityType: "User",
    entityId: createdUser.id,
  });

  // Auto-login
  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch {
    return {
      ok: true,
      message: "Account created. You can log in.",
      redirectTo: "/login",
    };
  }

  redirect("/dashboard");
}

// ------------------------------------------------------------
// LOGOUT
// ------------------------------------------------------------
export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/login");
}

// ------------------------------------------------------------
// FORGOT PASSWORD
// ------------------------------------------------------------
export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Email invalid" };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Always show success to prevent user enumeration.
  if (user) {
    const token = randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpires: new Date(Date.now() + 1000 * 60 * 60), // 1h
      },
    });
    const url = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
    await sendMail({
      to: email,
      subject: "TMS password reset",
      html: `<p>To reset your password, open this link:</p><p><a href="${url}">${url}</a></p><p>The link expires in 1 hour.</p>`,
    });
  }

  return {
    ok: true,
    message: "If an account exists for this email, you will receive instructions.",
  };
}

// ------------------------------------------------------------
// RESET PASSWORD
// ------------------------------------------------------------
export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid data",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: parsed.data.token,
      resetTokenExpires: { gt: new Date() },
    },
  });
  if (!user) {
    return { ok: false, error: "Token invalid sau expirat." };
  }

  const hashed = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      resetToken: null,
      resetTokenExpires: null,
    },
  });

  await logAudit({
    action: "user.password_reset",
    userId: user.id,
    companyId: user.companyId,
  });

  return { ok: true, message: "Password changed. You can log in.", redirectTo: "/login" };
}
