import { z } from "zod";
import { TrailerStatus } from "@prisma/client";
import { fields } from "./_fields";

const statusValues = Object.values(TrailerStatus) as [TrailerStatus, ...TrailerStatus[]];

export const trailerSchema = z.object({
  plateNumber: z.string().min(2).max(20),
  type: fields.optionalString,
  capacityKg: fields.optionalNumber,
  volumeM3: fields.optionalNumber,
  yearOfManufacture: fields.optionalNumber,
  fleetNumber: fields.optionalNumber,
  pairedTruckId: fields.optionalString,
  insuranceExpiresAt: fields.optionalDate,
  itpExpiresAt: fields.optionalDate,
  status: z.enum(statusValues).default("AVAILABLE"),
  notes: fields.optionalString,
});

export const trailerUpdateSchema = trailerSchema.extend({ id: z.string().min(1) });

export type TrailerInput = z.infer<typeof trailerSchema>;
