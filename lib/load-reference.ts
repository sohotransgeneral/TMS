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
