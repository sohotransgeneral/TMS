import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email invalid"),
  password: z.string().min(6, "Minim 6 caractere"),
});

export const registerSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Email invalid"),
  password: z
    .string()
    .min(8, "Minim 8 caractere")
    .regex(/[A-Z]/, "At least one uppercase letter")
    .regex(/[0-9]/, "At least one digit"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email invalid"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z
    .string()
    .min(8, "Minim 8 caractere")
    .regex(/[A-Z]/, "At least one uppercase letter")
    .regex(/[0-9]/, "At least one digit"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
