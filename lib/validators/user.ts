import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fields } from "./_fields";

export const ROLE_VALUES = [
  "COMPANY_ADMIN",
  "DISPATCHER",
  "DRIVER",
  "ACCOUNTANT",
  "FLEET_MANAGER",
  "CUSTOMER",
] as const satisfies readonly Exclude<UserRole, "SUPER_ADMIN">[];

export const userCreateSchema = z.object({
  name: z.string().min(2, "Nume prea scurt"),
  email: z.string().email("Email invalid"),
  phone: fields.optionalString,
  role: z.enum(ROLE_VALUES),
  password: z
    .string()
    .min(8, "Minim 8 caractere")
    .regex(/[0-9]/, "O cifră"),
  active: z.coerce.boolean().default(true),
});

export const userUpdateSchema = userCreateSchema
  .partial({ password: true })
  .extend({
    id: z.string().min(1),
    password: z
      .union([z.string(), z.literal("")])
      .optional()
      .transform((v) => (v ? String(v) : undefined))
      .refine(
        (v) => v === undefined || (v.length >= 8 && /[0-9]/.test(v)),
        "Parola: min 8 caractere și o cifră",
      ),
  });

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
