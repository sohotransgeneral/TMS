import { prisma } from "@/lib/prisma";
import { getPeriodRange } from "@/components/drivers/driver-financial-report";

function calcTaxes(brut: number, casRate = 25, cassRate = 10, impozitRate = 10) {
  const cas = brut * (casRate / 100);
  const cass = brut * (cassRate / 100);
  const base = Math.max(0, brut - cas - cass);
  const impozit = base * (impozitRate / 100);
  const total = cas + cass + impozit;
  const net = brut - total;
  return { cas, cass, impozit, total, net };
}

function fmt(v: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(v);
}

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function getDriverFinancialData(
  driverId: string,
  salaryType: string | null,
  salaryPerKm: number | null,
  grossPercent: number | null,
  salaryFixedAmount: number | null,
  commissionRate: number | null,
  taxCas: number | null,
  taxCass: number | null,
  taxImpozit: number | null,
  period: string,
  companyCurrency: string = "USD",
) {
  const { from, to, label, periodKey } = getPeriodRange(period);

  const loads = await prisma.load.findMany({
    where: {
      driverId,
      pickupDate: { gte: from, lte: to },
      status: { in: ["DELIVERED", "POD_UPLOADED", "INVOICED", "PAID"] },
    },
    orderBy: { pickupDate: "asc" },
    select: {
      id: true,
      referenceNumber: true,
      pickupAddress: true,
      pickupCity: true,
      deliveryAddress: true,
      deliveryCity: true,
      pickupDate: true,
      deliveryDate: true,
      price: true,
      currency: true,
      actualDistanceKm: true,
      estimatedDistanceKm: true,
      status: true,
      customer: { select: { name: true } },
      truck: { select: { plateNumber: true } },
    },
  });

  const fuelAgg = await prisma.fuelEntry.aggregate({
    where: { driverId, occurredAt: { gte: from, lte: to } },
    _sum: { totalAmount: true },
    _count: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expensesRaw: any[] = await prisma.expense.findMany({
    where: { driverId, occurredAt: { gte: from, lte: to }, status: "APPROVED" },
  });

  // Driver-charged expenses reduce driver deductions; company-charged ones are company cost
  const expensesDriver = expensesRaw.filter((e) => e.chargedTo === "DRIVER");
  const expensesCompany = expensesRaw.filter((e) => e.chargedTo !== "DRIVER");

  function sumByType(list: { type: string; amount: number }[]) {
    const map: Record<string, number> = {};
    for (const e of list) map[e.type] = (map[e.type] ?? 0) + e.amount;
    return map;
  }
  const expenseMap = sumByType(expensesDriver);
  const expenseMapCompany = sumByType(expensesCompany);

  const truckIds = [...new Set(loads.map((l) => l.truck?.plateNumber ? l : null).filter(Boolean).map((l) => l!.truck!.plateNumber))];
  const truckIdsFull = [...new Set(
    (await prisma.load.findMany({ where: { driverId, pickupDate: { gte: from, lte: to } }, select: { truckId: true } }))
      .map((l) => l.truckId).filter(Boolean)
  )] as string[];

  const permitsAgg = truckIdsFull.length
    ? await prisma.truckPermit.aggregate({
        where: { truckId: { in: truckIdsFull }, validFrom: { gte: from, lte: to } },
        _sum: { cost: true },
      })
    : null;

  const maintAgg = truckIdsFull.length
    ? await prisma.maintenance.aggregate({
        where: { truckId: { in: truckIdsFull }, completedAt: { gte: from, lte: to } },
        _sum: { cost: true },
      })
    : null;

  const revenue = loads.reduce((s, l) => s + l.price, 0);
  const totalKm = loads.reduce((s, l) => s + (l.actualDistanceKm ?? l.estimatedDistanceKm ?? 0), 0);
  const fuelCost = fuelAgg._sum.totalAmount ?? 0;
  const permitsCost = permitsAgg?._sum.cost ?? 0;
  const maintCost = maintAgg?._sum.cost ?? 0;

  const expenseMapAll: Record<string, number> = {};
  for (const e of expensesRaw) expenseMapAll[e.type] = (expenseMapAll[e.type] ?? 0) + e.amount;

  const tollCost = expenseMap["TOLL"] ?? 0;
  const parkingCost = expenseMap["PARKING"] ?? 0;
  const repairCost = expenseMap["REPAIR"] ?? 0;
  const otherCost = (expenseMap["OTHER"] ?? 0) + (expenseMap["COMMISSION"] ?? 0) + (expenseMap["INSURANCE"] ?? 0);
  // Company-side cost breakdown (for reference)
  const companyCosts = {
    toll: expenseMapCompany["TOLL"] ?? 0,
    parking: expenseMapCompany["PARKING"] ?? 0,
    repair: expenseMapCompany["REPAIR"] ?? 0,
    other: (expenseMapCompany["OTHER"] ?? 0) + (expenseMapCompany["COMMISSION"] ?? 0) + (expenseMapCompany["INSURANCE"] ?? 0),
  };
  const totalDeductions = fuelCost + permitsCost + maintCost + tollCost + parkingCost + repairCost + otherCost;
  const netContribution = revenue - totalDeductions;

  const type = salaryType ?? "PER_MI";
  let baseSalary = 0;
  if (type === "PERCENT_GROSS") {
    baseSalary = grossPercent ? revenue * (grossPercent / 100) : 0;
  } else if (type === "FIXED") {
    baseSalary = salaryFixedAmount ?? 0;
  } else {
    baseSalary = salaryPerKm ? totalKm * salaryPerKm : 0;
  }
  const commission = type === "PER_MI" && commissionRate ? revenue * (commissionRate / 100) : 0;

  // Manual adjustments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adjustments: Array<{ id: string; label: string; amount: number; proofUrl: string | null }> =
    await (prisma as any).driverAdjustment.findMany({
      where: { driverProfileId: driverId, periodKey },
      orderBy: { createdAt: "asc" },
    });
  const adjustmentsTotal = adjustments.reduce((s, a) => s + a.amount, 0);

  const brutSalary = baseSalary + commission + adjustmentsTotal;
  const taxes = calcTaxes(Math.max(0, brutSalary), taxCas ?? 25, taxCass ?? 10, taxImpozit ?? 10);
  const currency = loads[0]?.currency ?? companyCurrency;

  return {
    loads,
    revenue,
    totalKm,
    salaryType: type,
    salaryPerKm,
    grossPercent,
    salaryFixedAmount,
    commissionRate,
    fuelCost,
    fuelCount: fuelAgg._count,
    tollCost,
    parkingCost,
    repairCost,
    maintCost,
    permitsCost,
    otherCost,
    totalDeductions,
    netContribution,
    baseSalary,
    commission,
    adjustments,
    adjustmentsTotal,
    brutSalary,
    taxes,
    taxRates: { cas: taxCas ?? 25, cass: taxCass ?? 10, impozit: taxImpozit ?? 10 },
    companyCosts,
    currency,
    periodLabel: label,
    fmt,
    fmtDate,
  };
}
