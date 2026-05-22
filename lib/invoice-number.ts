import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Generates an invoice number using the company's `invoicePrefix` + `invoiceCounter`.
 * Format: `${prefix}-${year}-${seq.padStart(5,"0")}`.
 *
 * Increments `invoiceCounter` atomically.
 */
export async function nextInvoiceNumber(companyId: string): Promise<{ number: string; series: string }> {
  const company = await prisma.company.update({
    where: { id: companyId },
    data: { invoiceCounter: { increment: 1 } },
    select: { invoicePrefix: true, invoiceCounter: true },
  });
  const year = new Date().getFullYear();
  const prefix = company.invoicePrefix || "INV";
  const seq = String(company.invoiceCounter).padStart(5, "0");
  return { number: `${prefix}-${year}-${seq}`, series: prefix };
}
