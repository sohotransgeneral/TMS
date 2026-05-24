import { prisma } from "@/lib/prisma";
import { cache } from "react";

/**
 * Cached helper to fetch the company's default currency for the current
 * request. Safe to call from any server component / server action.
 */
export const getCompanyCurrency = cache(async (companyId: string | null | undefined): Promise<string> => {
  if (!companyId) return "USD";
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { currency: true },
  });
  return company?.currency || "USD";
});
