import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email invalid"),
  password: z.string().min(6, "Minim 6 caractere"),
});

export const registerSchema = z.object({
  companyName: z.string().min(2, "Numele companiei este obligatoriu"),
  name: z.string().min(2, "Numele este obligatoriu"),
  email: z.string().email("Email invalid"),
  password: z
    .string()
    .min(8, "Minim 8 caractere")
    .regex(/[A-Z]/, "Cel puțin o literă mare")
    .regex(/[0-9]/, "Cel puțin o cifră"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email invalid"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z
    .string()
    .min(8, "Minim 8 caractere")
    .regex(/[A-Z]/, "Cel puțin o literă mare")
    .regex(/[0-9]/, "Cel puțin o cifră"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
