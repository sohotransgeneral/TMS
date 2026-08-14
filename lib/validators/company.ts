import { z } from "zod";
import { fields } from "./_fields";

export const companySchema = z.object({
  name: z.string().min(2, "Nume prea scurt").max(120),
  legalName: fields.optionalString,
  taxId: fields.optionalString,
  registrationNumber: fields.optionalString,
  mcNumber: fields.optionalString,
  dotNumber: fields.optionalString,
  email: z.string().email("Email invalid").optional().or(z.literal("").transform(() => undefined)),
  phone: fields.optionalString,
  website: fields.optionalString,
  logoUrl: fields.optionalString,

  street: fields.optionalString,
  city: fields.optionalString,
  county: fields.optionalString,
  postalCode: fields.optionalString,
  country: fields.optionalString,

  bankName: fields.optionalString,
  bankAccount: fields.optionalString,
  currency: z.string().min(3).max(3).default("USD"),
  vatRate: z.coerce.number().min(0).max(100).default(19),
  // Not optionalString: that turns "" into undefined, which Prisma skips — so
  // clearing the prefix and saving left the old one in place. An empty field
  // here is a decision ("no prefix"), so it has to reach the database as "".
  invoicePrefix: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v.trim())),

  timezone: z.string().default("Europe/Bucharest"),
  locale: z.string().default("ro"),
});

export type CompanyInput = z.infer<typeof companySchema>;
