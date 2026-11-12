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

/** "STL-516" when the company has a prefix, plain "516" when it doesn't. */
function withPrefix(prefix: string, seq: string): string {
  return prefix ? `${prefix}-${seq}` : seq;
}

/**
 * The invoice for a load carries the load's own number — load 516 is invoice
 * 516 (or "STL-516"), so the two can be matched at a glance and both keep
 * counting up together.
 *
 * Falls back to the next free number in the invoice sequence when that number
 * is already taken (a hand-made invoice that landed on it first), so creating
 * an invoice never fails over a clash.
 */
export async function invoiceNumberForLoad(
  companyId: string,
  loadReference: string,
): Promise<{ number: string; series: string }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { invoicePrefix: true },
  });
  const prefix = (company?.invoicePrefix ?? "").trim();
  const number = withPrefix(prefix, loadReference.trim());

  const taken = await prisma.invoice.findFirst({
    where: { companyId, number },
    select: { id: true },
  });
  return taken ? nextInvoiceNumber(companyId) : { number, series: prefix };
}

/**
 * Re-numbers the invoices of loads whose number changed (edited by hand, or
 * pulled down after a delete) so each invoice keeps matching its load.
 *
 * Two passes — the unique index on (companyId, number) rejects a rename onto a
 * number another invoice still holds, and shifted numbers overlap by design.
 * An invoice whose target is held by an unrelated invoice is left alone rather
 * than failing the whole change.
 */
export async function syncInvoiceNumbersToLoads(
  companyId: string,
  moved: { id: string; to: string }[],
): Promise<void> {
  if (moved.length === 0) return;

  const [company, invoices] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { invoicePrefix: true },
    }),
    prisma.invoice.findMany({
      where: { companyId },
      select: { id: true, number: true, loadId: true },
    }),
  ]);
  const prefix = (company?.invoicePrefix ?? "").trim();

  const movingLoadIds = new Set(moved.map((m) => m.id));
  const movingInvoiceIds = new Set(
    invoices.filter((i) => i.loadId && movingLoadIds.has(i.loadId)).map((i) => i.id),
  );
  // Numbers that stay where they are and so can't be reused.
  const held = new Set(
    invoices.filter((i) => !movingInvoiceIds.has(i.id)).map((i) => i.number),
  );

  const changes = moved
    .map((m) => ({
      invoice: invoices.find((i) => i.loadId === m.id),
      next: withPrefix(prefix, m.to),
    }))
    .filter(
      (c): c is { invoice: (typeof invoices)[number]; next: string } =>
        c.invoice != null && c.invoice.number !== c.next && !held.has(c.next),
    );

  for (const c of changes) {
    await prisma.invoice.update({
      where: { id: c.invoice.id },
      data: { number: `tmp-${c.invoice.id}` },
    });
  }
  for (const c of changes) {
    await prisma.invoice.update({
      where: { id: c.invoice.id },
      data: { number: c.next, series: prefix || null },
    });
  }
}
