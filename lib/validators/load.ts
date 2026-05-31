import { z } from "zod";
import { fields } from "./_fields";

const { optionalString, optionalNumber } = fields;

export const LOAD_STATUSES = [
  "DRAFT",
  "ASSIGNED",
  "DRIVER_ACCEPTED",
  "ON_WAY_TO_PICKUP",
  "AT_PICKUP",
  "LOADED",
  "IN_TRANSIT",
  "AT_DELIVERY",
  "DELIVERED",
  "POD_UPLOADED",
  "INVOICED",
  "PAID",
  "CANCELLED",
] as const;

export const LOAD_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ASSIGNED: "Assigned",
  DRIVER_ACCEPTED: "Accepted",
  ON_WAY_TO_PICKUP: "On Way to Pickup",
  AT_PICKUP: "At Pickup",
  LOADED: "Loaded",
  IN_TRANSIT: "In Transit",
  AT_DELIVERY: "At Delivery",
  DELIVERED: "Delivered",
  POD_UPLOADED: "POD Uploaded",
  INVOICED: "Invoiced",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

/** Allowed transitions from current status — used to validate updates. */
export const LOAD_NEXT_STATUSES: Record<string, readonly string[]> = {
  DRAFT: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["DRIVER_ACCEPTED", "ON_WAY_TO_PICKUP", "CANCELLED"],
  DRIVER_ACCEPTED: ["ON_WAY_TO_PICKUP", "CANCELLED"],
  ON_WAY_TO_PICKUP: ["AT_PICKUP", "CANCELLED"],
  AT_PICKUP: ["LOADED", "CANCELLED"],
  LOADED: ["IN_TRANSIT", "AT_PICKUP"],
  IN_TRANSIT: ["AT_DELIVERY", "AT_PICKUP"],
  AT_DELIVERY: ["DELIVERED", "IN_TRANSIT"],
  DELIVERED: ["POD_UPLOADED", "INVOICED"],
  POD_UPLOADED: ["INVOICED"],
  INVOICED: ["PAID"],
  PAID: [],
  CANCELLED: [],
};

export const loadCreateSchema = z.object({
  customerId: optionalString,

  pickupCompanyName: optionalString,
  pickupAddress: z.string().min(3, "Address required"),
  pickupCity: optionalString,
  pickupState: optionalString,
  pickupZip: optionalString,
  pickupCountry: optionalString,
  pickupLat: optionalNumber,
  pickupLng: optionalNumber,
  pickupDate: z.coerce.date({ message: "Pickup date is required" }),
  pickupWindow: optionalString,
  pickupContact: optionalString,
  pickupPhone: optionalString,
  pickupNotes: optionalString,

  deliveryCompanyName: optionalString,
  deliveryAddress: z.string().min(3, "Address required"),
  deliveryCity: optionalString,
  deliveryState: optionalString,
  deliveryZip: optionalString,
  deliveryCountry: optionalString,
  deliveryLat: optionalNumber,
  deliveryLng: optionalNumber,
  deliveryDate: z.coerce.date({ message: "Delivery date is required" }),
  deliveryWindow: optionalString,
  deliveryContact: optionalString,
  deliveryPhone: optionalString,
  deliveryNotes: optionalString,

  loadType: optionalString,
  equipment: optionalString,
  commodity: optionalString,

  cargoDescription: optionalString,
  weightKg: optionalNumber,
  volumeM3: optionalNumber,
  packages: optionalNumber,
  isHazardous: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).optional(),
  temperature: optionalString,

  price: z.coerce.number().min(0, "Invalid price"),
  currency: z.string().default("USD"),
  lineHaulRate: optionalNumber,
  fuelSurcharge: optionalNumber,
  estimatedDistanceKm: optionalNumber,

  poNumber: optionalString,
  soNumber: optionalString,

  brokerName: optionalString,
  brokerPhone: optionalString,
  brokerEmail: optionalString,

  specialInstructions: optionalString,

  driverId: optionalString,
  truckId: optionalString,
  trailerId: optionalString,
  internalNotes: optionalString,
});

export const loadUpdateSchema = loadCreateSchema.partial().extend({
  id: z.string().min(1),
});

export const loadAssignSchema = z.object({
  id: z.string().min(1),
  driverId: optionalString,
  truckId: optionalString,
  trailerId: optionalString,
});

export const loadStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(LOAD_STATUSES),
  note: optionalString,
  lat: optionalNumber,
  lng: optionalNumber,
});

export type LoadCreateInput = z.infer<typeof loadCreateSchema>;
