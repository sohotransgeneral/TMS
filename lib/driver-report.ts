import { prisma } from "@/lib/prisma";
import { getPeriodRange } from "@/components/drivers/driver-financial-report";

function calcTaxes(brut: number) {
  const cas = brut * 0.25;
  const cass = brut * 0.10;
  const base = Math.max(0, brut - cas - cass);
  const impozit = base * 0.10;
  const total = cas + cass + impozit;
  const net = brut - total;
  return { cas, cass, impozit, total, net };
}

function fmt(v: number, currency = "EUR") {
  return new Intl.NumberFormat("ro-RO", { style: "currency", currency, minimumFractionDigits: 2 }).format(v);
}

function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function getDriverFinancialData(
  driverId: string,
  salaryPerKm: number | null,
  commissionRate: number | null,
  period: string,
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

  const expenses = await prisma.expense.groupBy({
    by: ["type"],
    where: { driverId, occurredAt: { gte: from, lte: to }, status: "APPROVED" },
    _sum: { amount: true },
  });

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

  const expenseMap: Record<string, number> = {};
  for (const e of expenses) expenseMap[e.type] = e._sum.amount ?? 0;
  const tollCost = expenseMap["TOLL"] ?? 0;
  const parkingCost = expenseMap["PARKING"] ?? 0;
  const repairCost = expenseMap["REPAIR"] ?? 0;
  const otherCost = (expenseMap["OTHER"] ?? 0) + (expenseMap["COMMISSION"] ?? 0) + (expenseMap["INSURANCE"] ?? 0);
  const totalDeductions = fuelCost + permitsCost + maintCost + tollCost + parkingCost + repairCost + otherCost;
  const netContribution = revenue - totalDeductions;

  const baseSalary = salaryPerKm ? totalKm * salaryPerKm : 0;
  const commission = commissionRate ? revenue * (commissionRate / 100) : 0;

  // Manual adjustments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adjustments: Array<{ id: string; label: string; amount: number; proofUrl: string | null }> =
    await (prisma as any).driverAdjustment.findMany({
      where: { driverProfileId: driverId, periodKey },
      orderBy: { createdAt: "asc" },
    });
  const adjustmentsTotal = adjustments.reduce((s, a) => s + a.amount, 0);

  const brutSalary = baseSalary + commission + adjustmentsTotal;
  const taxes = calcTaxes(Math.max(0, brutSalary));
  const currency = loads[0]?.currency ?? "EUR";

  return {
    loads,
    revenue,
    totalKm,
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
    currency,
    periodLabel: label,
    fmt,
    fmtDate,
  };
}
