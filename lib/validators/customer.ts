import { z } from "zod";
import { fields } from "./_fields";

export const customerSchema = z.object({
  name: z.string().min(2),
  contactPerson: fields.optionalString,
  email: z.string().email("Email invalid").optional().or(z.literal("").transform(() => undefined)),
  phone: fields.optionalString,
  taxId: fields.optionalString,
  registrationNumber: fields.optionalString,
  street: fields.optionalString,
  city: fields.optionalString,
  county: fields.optionalString,
  postalCode: fields.optionalString,
  country: fields.optionalString,
  paymentTermsDays: fields.optionalNumber,
  creditLimit: fields.optionalNumber,
  notes: fields.optionalString,
});

export const customerUpdateSchema = customerSchema.extend({ id: z.string().min(1) });

export type CustomerInput = z.infer<typeof customerSchema>;
