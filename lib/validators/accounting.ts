import { z } from "zod";
import { fields } from "./_fields";

const { optionalString, optionalNumber, optionalDate } = fields;

export const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"] as const;
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.coerce.number().min(0.001, "Invalid quantity"),
  unitPrice: z.coerce.number().min(0, "Invalid price"),
});
export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

/**
 * Form-submitted invoices arrive with parallel arrays:
 *   items.description[], items.quantity[], items.unitPrice[]
 */
export const invoiceCreateSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  loadId: optionalString,
  series: optionalString,
  issueDate: z.coerce.date({ message: "Invalid issue date" }),
  dueDate: z.coerce.date({ message: "Invalid due date" }),
  vatRate: z.coerce.number().min(0).max(100).default(19),
  currency: z.string().default("RON"),
  notes: optionalString,
  items: z.array(invoiceItemSchema).min(1, "Add at least one line item"),
});

export const invoiceUpdateSchema = invoiceCreateSchema.partial().extend({
  id: z.string().min(1),
});

export const invoiceStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(INVOICE_STATUSES),
});

export const paymentCreateSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().min(0.01, "Invalid amount"),
  currency: z.string().default("RON"),
  method: optionalString,
  reference: optionalString,
  paidAt: z.coerce.date({ message: "Invalid payment date" }),
  notes: optionalString,
});

// ---- Expenses ----
export const EXPENSE_TYPES = ["FUEL", "TOLL", "PARKING", "REPAIR", "SALARY", "COMMISSION", "INSURANCE", "OTHER"] as const;
export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  FUEL: "Fuel", TOLL: "Toll", PARKING: "Parking", REPAIR: "Repair",
  SALARY: "Salary", COMMISSION: "Commission", INSURANCE: "Insurance", OTHER: "Other",
};
export const EXPENSE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const EXPENSE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected",
};

export const expenseCreateSchema = z.object({
  type: z.enum(EXPENSE_TYPES),
  amount: z.coerce.number().min(0.01, "Invalid amount"),
  currency: z.string().default("RON"),
  description: optionalString,
  occurredAt: z.coerce.date({ message: "Invalid date" }),
  loadId: optionalString,
  truckId: optionalString,
  driverId: optionalString,
  receiptUrl: optionalString,
});

export const expenseUpdateSchema = expenseCreateSchema.partial().extend({
  id: z.string().min(1),
});

export const expenseDecisionSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

// ---- Fuel ----
export const fuelCreateSchema = z.object({
  truckId: optionalString,
  driverId: optionalString,
  loadId: optionalString,
  liters: z.coerce.number().min(0.01, "Invalid liters"),
  pricePerLiter: z.coerce.number().min(0, "Invalid price"),
  totalAmount: optionalNumber, // auto-computed if missing
  currency: z.string().default("RON"),
  station: optionalString,
  mileage: optionalNumber,
  occurredAt: z.coerce.date({ message: "Invalid date" }),
  receiptUrl: optionalString,
});

export const fuelUpdateSchema = fuelCreateSchema.partial().extend({
  id: z.string().min(1),
});

// silence unused import linter on platforms that don't preserve unused
void optionalDate;
