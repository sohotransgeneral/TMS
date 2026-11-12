import { prisma } from "@/lib/prisma";
import { loadTotal } from "@/lib/accessorials";
import { splitExternal } from "@/lib/external-driver";

/**
 * Per-company figures for external drivers: what their loads brought in and
 * how it was divided between us, the drivers and the company that lent them.
 * Only delivered loads count, same as the driver financial report.
 */
export type PartnerStatsRow = {
  company: string;
  drivers: number;
  loads: number;
  total: number;
  our: number;
  driver: number;
  partner: number;
};

const DELIVERED = ["DELIVERED", "POD_UPLOADED", "INVOICED", "PAID"] as const;

/** "Company X" and "company x " are the same company. */
const keyOf = (name: string) => name.trim().toLowerCase();

/** Every company name already used, for suggestions in the driver form. */
export async function partnerCompanyNames(companyId?: string): Promise<string[]> {
  const drivers = await prisma.driverProfile.findMany({
    where: { companyId, isExternal: true, externalCompany: { not: null } },
    select: { externalCompany: true },
  });
  const seen = new Map<string, string>();
  for (const d of drivers) {
    const name = d.externalCompany?.trim();
    if (name && !seen.has(keyOf(name))) seen.set(keyOf(name), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export async function getPartnerStats(
  companyId: string | undefined,
  from: Date,
  to: Date,
): Promise<PartnerStatsRow[]> {
  const drivers = await prisma.driverProfile.findMany({
    where: { companyId, isExternal: true },
    select: {
      id: true,
      externalCompany: true,
      grossPercent: true,
      ourCutPercent: true,
    },
  });
  if (drivers.length === 0) return [];

  const loads = await prisma.load.findMany({
    where: {
      driverId: { in: drivers.map((d) => d.id) },
      status: { in: [...DELIVERED] },
      pickupDate: { gte: from, lte: to },
    },
    select: { driverId: true, price: true, accessorialAmount: true },
  });

  const rows = new Map<string, PartnerStatsRow>();
  const driversOf = new Map<string, Set<string>>();

  for (const d of drivers) {
    const name = d.externalCompany?.trim() || "(no company)";
    const key = keyOf(name);
    if (!rows.has(key)) {
      rows.set(key, { company: name, drivers: 0, loads: 0, total: 0, our: 0, driver: 0, partner: 0 });
      driversOf.set(key, new Set());
    }
    driversOf.get(key)!.add(d.id);
  }

  for (const l of loads) {
    const d = drivers.find((x) => x.id === l.driverId);
    if (!d) continue;
    const key = keyOf(d.externalCompany?.trim() || "(no company)");
    const row = rows.get(key)!;
    const split = splitExternal(loadTotal(l), d.ourCutPercent ?? 0, d.grossPercent ?? 0);
    row.loads += 1;
    row.total += split.total;
    row.our += split.our;
    row.driver += split.driver;
    row.partner += split.partner;
  }

  for (const [key, row] of rows) row.drivers = driversOf.get(key)!.size;

  return [...rows.values()].sort((a, b) => b.total - a.total);
}
