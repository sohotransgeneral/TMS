import { z } from "zod";
import { DriverStatus } from "@prisma/client";
import { fields } from "./_fields";

const statusValues = Object.values(DriverStatus) as [DriverStatus, ...DriverStatus[]];

export const driverCreateSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email("Email invalid"),
  phone: fields.optionalString,
  password: z.string().min(8, "Minim 8 caractere"),

  cnp: fields.optionalString,
  dateOfBirth: fields.optionalDate,

  licenseNumber: fields.optionalString,
  licenseCategories: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (!v) return [];
      if (Array.isArray(v)) return v.filter(Boolean);
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    }),
  licenseIssuedAt: fields.optionalDate,
  licenseExpiresAt: fields.optionalDate,
  tachoCardNumber: fields.optionalString,
  tachoCardExpiresAt: fields.optionalDate,
  employedSince: fields.optionalDate,
  salaryType: z.string().optional().default("PER_MI"),
  salaryPerKm: fields.optionalNumber,
  salaryFixedAmount: fields.optionalNumber,
  grossPercent: fields.optionalNumber,
  commissionRate: fields.optionalNumber,

  status: z.enum(statusValues).default("AVAILABLE"),
  internalNotes: fields.optionalString,
});

export const driverUpdateSchema = driverCreateSchema
  .partial({ password: true, email: true })
  .extend({
    id: z.string().min(1),
    // Allow empty string → treat as "no change"
    password: z
      .string()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined))
      .pipe(z.string().min(8, "Minim 8 caractere").optional()),
  });

export type DriverCreateInput = z.infer<typeof driverCreateSchema>;
export type DriverUpdateInput = z.infer<typeof driverUpdateSchema>;
