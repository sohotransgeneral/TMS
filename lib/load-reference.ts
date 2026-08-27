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
 * 516, 517, 518, 519.
 *
 * `base` is the lowest number that existed BEFORE the deletion, so removing
 * the first load pulls the rest down to it instead of stranding the sequence
 * one higher.
 *
 * Renaming happens in two passes. Moving 519 onto 518 while a load still holds
 * 518 trips the unique index on (companyId, referenceNumber) and would leave
 * the renumbering half-applied, so everything is parked on a temporary name
 * first.
 */
export async function resequenceLoadReferences(
  companyId: string,
  base: number,
): Promise<void> {
  const loads = await prisma.load.findMany({
    where: { companyId },
    select: { id: true, referenceNumber: true },
  });

  const ordered = loads
    .map((l) => ({ ...l, seq: sequenceOf(l.referenceNumber) }))
    .filter((l) => Number.isFinite(l.seq))
    .sort((a, b) => a.seq - b.seq);

  const target = ordered.map((l, i) => ({ ...l, next: String(base + i) }));
  const changed = target.filter((l) => l.next !== l.referenceNumber);
  if (changed.length === 0) return;

  for (const l of changed) {
    await prisma.load.update({
      where: { id: l.id },
      data: { referenceNumber: `tmp-${l.id}` },
    });
  }
  for (const l of changed) {
    await prisma.load.update({
      where: { id: l.id },
      data: { referenceNumber: l.next },
    });
  }
}

/** Lowest reference number currently issued, or null when there are none. */
export async function lowestLoadSequence(companyId: string): Promise<number | null> {
  const loads = await prisma.load.findMany({
    where: { companyId },
    select: { referenceNumber: true },
  });
  const seqs = loads.map((l) => sequenceOf(l.referenceNumber)).filter(Number.isFinite);
  return seqs.length ? Math.min(...seqs) : null;
}
