import { prisma } from "@/lib/prisma";

/**
 * Generates the next human-readable load reference, e.g. `L-2026-00042`.
 *
 * Derived from the HIGHEST reference already issued this year, not from a count
 * of loads: counting breaks the moment a load is deleted. With 16 loads issued
 * and 12 deleted, a count-based sequence hands out L-2026-00005 again and the
 * insert dies on the unique index.
 *
 * The 5-digit zero padding is what makes the plain string sort equal a numeric
 * sort, so "take the largest" is a single indexed query.
 *
 * Callers must still handle a duplicate: two dispatchers saving in the same
 * moment can both read the same maximum. `createLoad` retries on P2002.
 */
export async function nextLoadReference(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `L-${year}-`;

  const last = await prisma.load.findFirst({
    where: { companyId, referenceNumber: { startsWith: prefix } },
    orderBy: { referenceNumber: "desc" },
    select: { referenceNumber: true },
  });

  const lastSeq = last ? Number(last.referenceNumber.slice(prefix.length)) : 0;
  const next = Number.isFinite(lastSeq) && lastSeq > 0 ? lastSeq + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}
