import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Next invoice number: `${prefix}-${seq}`, or just `${seq}` when the company
 * has cleared its prefix in settings. No year — "STL-2026-00031" carries a
 * year nobody quotes and a padding nobody counts; "STL-516" is what ends up on
 * a broker's remittance.
 *
 * The sequence follows the highest number already issued rather than a stored
 * counter, so deleting an invoice can't hand the next one a number that is
 * still in use. Existing numbers in any older format still count — only the
 * trailing digits are read.
 */
function sequenceOf(number: string): number {
  const digits = /(\d+)\s*$/.exec(number.trim());
  return digits ? Number(digits[1]) : NaN;
}

export async function nextInvoiceNumber(
  companyId: string,
): Promise<{ number: string; series: string }> {
  const [company, invoices] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { invoicePrefix: true },
    }),
    prisma.invoice.findMany({
      where: { companyId },
      select: { number: true },
    }),
  ]);

  let highest = 0;
  for (const { number } of invoices) {
    const seq = sequenceOf(number);
    if (Number.isFinite(seq) && seq > highest) highest = seq;
  }

  const prefix = (company?.invoicePrefix ?? "").trim();
  const seq = String(highest > 0 ? highest + 1 : 1);

  // The counter is no longer the source of truth, but other screens still show
  // it, so keep it moving with the sequence.
  await prisma.company
    .update({
      where: { id: companyId },
      data: { invoiceCounter: Number(seq) },
    })
    .catch(() => undefined);

  return { number: prefix ? `${prefix}-${seq}` : seq, series: prefix };
}
