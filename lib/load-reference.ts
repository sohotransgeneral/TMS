import { prisma } from "@/lib/prisma";

/**
 * Next load reference — a plain sequential number ("516", "517", "518"), no
 * prefix and no year. Carriers quote these over the phone; "L-2026-00517" is
 * four syllables of ceremony around the only part anyone says out loud.
 *
 * Derived from the highest number already issued, never from a count: counting
 * breaks as soon as a load is deleted and starts handing out numbers that are
 * still in use.
 *
 * Older references such as "L-2026-00008" are still recognised — the trailing
 * digits are what count — so the sequence continues over existing data.
 *
 * Callers must handle a duplicate anyway: two dispatchers saving in the same
 * moment can both read the same maximum. `createLoad` retries on P2002.
 */

/** First number issued when a company has no loads yet. */
const SEQUENCE_START = 1;

function sequenceOf(reference: string): number {
  const digits = /(\d+)\s*$/.exec(reference.trim());
  return digits ? Number(digits[1]) : NaN;
}

export async function nextLoadReference(companyId: string): Promise<string> {
  const loads = await prisma.load.findMany({
    where: { companyId },
    select: { referenceNumber: true },
  });

  let highest = 0;
  for (const { referenceNumber } of loads) {
    const seq = sequenceOf(referenceNumber);
    if (Number.isFinite(seq) && seq > highest) highest = seq;
  }

  return String(highest > 0 ? highest + 1 : SEQUENCE_START);
}

/**
 * Closes the gap left by a deleted load: 516, 517, 519, 520 becomes
 * 516, 517, 518, 519 once 518 is deleted.
 *
 * Only the unbroken run right after the deleted number moves down. A number
 * somebody set by hand (jumping from 520 to 600, say) is a deliberate restart
 * of the sequence, so closing the gap would silently undo it.
 *
 * Moving happens in ascending order — each load steps into the number the
 * previous one just freed — so the unique index on (companyId, referenceNumber)
 * is never hit.
 *
 * Returns what moved so the caller can keep each load's invoice number in step.
 */
export async function closeLoadReferenceGap(
  companyId: string,
  deletedReference: string,
): Promise<{ id: string; from: string; to: string }[]> {
  const deleted = sequenceOf(deletedReference);
  if (!Number.isFinite(deleted)) return [];

  const loads = await prisma.load.findMany({
    where: { companyId },
    select: { id: true, referenceNumber: true },
  });

  const above = loads
    .map((l) => ({ ...l, seq: sequenceOf(l.referenceNumber) }))
    .filter((l) => Number.isFinite(l.seq) && l.seq > deleted)
    .sort((a, b) => a.seq - b.seq);

  const moved: { id: string; from: string; to: string }[] = [];
  let expected = deleted + 1;
  for (const l of above) {
    if (l.seq !== expected) break;
    const to = String(l.seq - 1);
    await prisma.load.update({ where: { id: l.id }, data: { referenceNumber: to } });
    moved.push({ id: l.id, from: l.referenceNumber, to });
    expected++;
  }
  return moved;
}

/** Newest first: highest number on top; anything without a number goes last. */
export function byReferenceDesc(
  a: { referenceNumber: string },
  b: { referenceNumber: string },
): number {
  const x = sequenceOf(a.referenceNumber);
  const y = sequenceOf(b.referenceNumber);
  if (Number.isNaN(x) && Number.isNaN(y)) return 0;
  if (Number.isNaN(x)) return 1;
  if (Number.isNaN(y)) return -1;
  return y - x;
}
