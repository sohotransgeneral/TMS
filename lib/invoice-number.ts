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

/**
 * Closes the gap left by a deleted invoice, the same way loads are resequenced.
 *
 * Worth being clear about what this means: an invoice number that has already
 * been sent to a customer will change, and their remittance will quote a number
 * that no longer matches. This runs because it was asked for explicitly — most
 * accounting practice (and law, in many countries) treats an issued invoice
 * number as permanent and closes gaps with a credit note instead.
 */
export async function resequenceInvoiceNumbers(
  companyId: string,
  base: number,
): Promise<void> {
  const [company, invoices] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { invoicePrefix: true },
    }),
    prisma.invoice.findMany({
      where: { companyId },
      select: { id: true, number: true },
    }),
  ]);

  const prefix = (company?.invoicePrefix ?? "").trim();
  const ordered = invoices
    .map((i) => ({ ...i, seq: sequenceOf(i.number) }))
    .filter((i) => Number.isFinite(i.seq))
    .sort((a, b) => a.seq - b.seq);

  const target = ordered.map((inv, i) => {
    const seq = String(base + i);
    return { ...inv, next: prefix ? `${prefix}-${seq}` : seq };
  });
  const changed = target.filter((i) => i.next !== i.number);
  if (changed.length === 0) return;

  // Two passes — the unique index on (companyId, number) rejects a rename onto
  // a number another invoice still holds.
  for (const inv of changed) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { number: `tmp-${inv.id}` },
    });
  }
  for (const inv of changed) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { number: inv.next, series: prefix || null },
    });
  }
}

/** Lowest invoice sequence currently issued, or null when there are none. */
export async function lowestInvoiceSequence(companyId: string): Promise<number | null> {
  const invoices = await prisma.invoice.findMany({
    where: { companyId },
    select: { number: true },
  });
  const seqs = invoices.map((i) => sequenceOf(i.number)).filter(Number.isFinite);
  return seqs.length ? Math.min(...seqs) : null;
}
