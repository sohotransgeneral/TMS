import { z } from "zod";
import { TruckStatus } from "@prisma/client";
import { fields } from "./_fields";

const statusValues = Object.values(TruckStatus) as [TruckStatus, ...TruckStatus[]];

export const truckSchema = z.object({
  plateNumber: z.string().min(2).max(20),
  vin: fields.optionalString,
  make: fields.optionalString,
  model: fields.optionalString,
  year: fields.optionalNumber,
  color: fields.optionalString,
  mileage: fields.optionalNumber,
  fuelType: fields.optionalString,
  avgConsumption: fields.optionalNumber,
  fleetNumber: fields.optionalNumber,
  pairedTrailerId: fields.optionalString,

  insuranceExpiresAt: fields.optionalDate,
  itpExpiresAt: fields.optionalDate,
  vignetteExpiresAt: fields.optionalDate,
  tachographExpiresAt: fields.optionalDate,

  status: z.enum(statusValues).default("AVAILABLE"),
  notes: fields.optionalString,
});

export const truckUpdateSchema = truckSchema.extend({ id: z.string().min(1) });

export type TruckInput = z.infer<typeof truckSchema>;
