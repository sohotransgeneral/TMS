import { prisma } from "@/lib/prisma";

/**
 * Generates a unique human-readable load reference like `L-2026-00042`.
 * Uses an in-DB counter on Company so reference numbers stay sequential per tenant.
 *
 * Note: we read+update inside a single Prisma call to avoid races.
 */
export async function nextLoadReference(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  // Count existing loads for this year + company to derive next number.
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const count = await prisma.load.count({
    where: { companyId, updatedAt: { gte: start, lt: end } },
  });
  const seq = String(count + 1).padStart(5, "0");
  return `L-${year}-${seq}`;
}
