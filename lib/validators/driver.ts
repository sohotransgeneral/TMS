import { z } from "zod";
import { DriverStatus } from "@prisma/client";
import { fields } from "./_fields";

const statusValues = Object.values(DriverStatus) as [DriverStatus, ...DriverStatus[]];

// Empty string → not provided
const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.string().email("Email invalid").optional());

const optionalPassword = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .pipe(z.string().min(8, "Minim 8 caractere").optional());

export const driverCreateSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: optionalEmail,
  phone: fields.optionalString,
  password: optionalPassword,

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
  medicalCardNumber: fields.optionalString,
  medicalCardIssuedAt: fields.optionalDate,
  medicalCardExpiresAt: fields.optionalDate,
  tachoCardNumber: fields.optionalString,
  tachoCardExpiresAt: fields.optionalDate,
  employedSince: fields.optionalDate,
  salaryType: z.string().optional().default("PER_MI"),
  salaryPerKm: fields.optionalNumber,
  salaryFixedAmount: fields.optionalNumber,
  grossPercent: fields.optionalNumber,
  commissionRate: fields.optionalNumber,

  // External driver — see lib/external-driver.ts
  isExternal: z
    .preprocess((v) => v === "on" || v === "true" || v === true, z.boolean())
    .optional(),
  externalCompany: fields.optionalString,
  ourCutPercent: fields.optionalNumber,
  taxCas: fields.optionalNumber,
  taxCass: fields.optionalNumber,
  taxImpozit: fields.optionalNumber,

  truckId: fields.optionalString,
  trailerId: fields.optionalString,

  telegramChatId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(
      z
        .string()
        .regex(/^-?\d+$/u, "Telegram chat id must be a numeric id")
        .optional(),
    )
    .optional(),

  status: z.enum(statusValues).default("AVAILABLE"),
  internalNotes: fields.optionalString,
});

export const driverUpdateSchema = driverCreateSchema.extend({
  id: z.string().min(1),
});

/**
 * Extra rules for an external driver: the company they belong to is needed for
 * the statistics, and the three shares must fit inside 100%. Returns field
 * errors, or null when everything is fine (or the driver isn't external).
 */
export function externalDriverErrors(d: {
  isExternal?: boolean;
  externalCompany?: string;
  ourCutPercent?: number;
  grossPercent?: number;
}): Record<string, string[]> | null {
  if (!d.isExternal) return null;
  const errors: Record<string, string[]> = {};
  if (!d.externalCompany) errors.externalCompany = ["Company is required"];
  const inRange = (n: number | undefined) =>
    n != null && n >= 0 && n <= 100;
  if (!inRange(d.ourCutPercent)) errors.ourCutPercent = ["Enter 0–100"];
  if (!inRange(d.grossPercent)) errors.grossPercent = ["Enter 0–100"];
  if (
    inRange(d.ourCutPercent) &&
    inRange(d.grossPercent) &&
    d.ourCutPercent! + d.grossPercent! > 100
  ) {
    errors.grossPercent = ["Our cut + driver can't be more than 100%"];
  }
  return Object.keys(errors).length ? errors : null;
}

export type DriverCreateInput = z.infer<typeof driverCreateSchema>;
export type DriverUpdateInput = z.infer<typeof driverUpdateSchema>;
