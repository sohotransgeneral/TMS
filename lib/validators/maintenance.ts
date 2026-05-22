import { z } from "zod";
import { fields } from "./_fields";

const { optionalString, optionalNumber, optionalDate } = fields;

export const MAINTENANCE_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const maintenanceCreateSchema = z
  .object({
    truckId: optionalString,
    trailerId: optionalString,
    title: z.string().min(2, "Title required"),
    description: optionalString,
    scheduledAt: z.coerce.date({ message: "Invalid scheduled date" }),
    completedAt: optionalDate,
    cost: optionalNumber,
    currency: z.string().default("USD"),
    mileage: optionalNumber,
    partsReplaced: z
      .union([z.string(), z.array(z.string()), z.undefined(), z.null()])
      .transform((v) => {
        if (!v) return [] as string[];
        if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
        return String(v)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      })
      .optional(),
    status: z.enum(MAINTENANCE_STATUSES).default("SCHEDULED"),
    notes: optionalString,
    documentUrl: optionalString,
  })
  .refine((d) => d.truckId || d.trailerId, {
    message: "Select a truck or trailer",
    path: ["truckId"],
  });

export const maintenanceUpdateSchema = z
  .object({
    id: z.string().min(1),
    truckId: optionalString,
    trailerId: optionalString,
    title: z.string().min(2).optional(),
    description: optionalString,
    scheduledAt: optionalDate,
    completedAt: optionalDate,
    cost: optionalNumber,
    currency: z.string().optional(),
    mileage: optionalNumber,
    partsReplaced: z
      .union([z.string(), z.array(z.string()), z.undefined(), z.null()])
      .transform((v) => {
        if (v === undefined || v === null) return undefined;
        if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
        return String(v).split(",").map((s) => s.trim()).filter(Boolean);
      })
      .optional(),
    status: z.enum(MAINTENANCE_STATUSES).optional(),
    notes: optionalString,
    documentUrl: optionalString,
  });
