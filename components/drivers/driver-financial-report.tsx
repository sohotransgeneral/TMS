import { prisma } from "@/lib/prisma";
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  ShieldCheck,
  Wrench,
  DollarSign,
  Calculator,
} from "lucide-react";

/* ─── date range ────────────────────────────────────────────── */
export function getPeriodRange(period: string): {
  from: Date;
  to: Date;
  label: string;
  periodKey: string;
} {
  const now = new Date();
  const from = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  const pad = (n: number) => String(n).padStart(2, "0");

  switch (period) {
    case "today":
      from.setHours(0, 0, 0, 0);
      return {
        from,
        to,
        label: now.toLocaleDateString("ro-RO", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        periodKey: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
      };
    case "week": {
      const day = from.getDay() || 7;
      from.setDate(from.getDate() - day + 1);
      from.setHours(0, 0, 0, 0);
      // ISO week number
      const weekNo = Math.ceil(
        ((from.getTime() - new Date(from.getFullYear(), 0, 1).getTime()) /
          86400000 +
          1) /
          7,
      );
      return {
        from,
        to,
        label: `Week ${from.toLocaleDateString("ro-RO", { day: "numeric", month: "short" })} – ${to.toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })}`,
        periodKey: `${from.getFullYear()}-W${pad(weekNo)}`,
      };
    }
    case "year":
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      return {
        from,
        to,
        label: `Anul ${from.getFullYear()}`,
        periodKey: `${from.getFullYear()}`,
      };
    default: // month
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      return {
        from,
        to,
        label: from.toLocaleDateString("ro-RO", {
          month: "long",
          year: "numeric",
        }),
        periodKey: `${from.getFullYear()}-${pad(from.getMonth() + 1)}`,
      };
  }
}

/* ─── tax calculation (RO) ──────────────────────────────────── */
function calcTaxes(
  brut: number,
  casRate = 25,
  cassRate = 10,
  impozitRate = 10,
) {
  const cas = brut * (casRate / 100);
  const cass = brut * (cassRate / 100);
  const base = Math.max(0, brut - cas - cass);
  const impozit = base * (impozitRate / 100);
  const total = cas + cass + impozit;
  const net = brut - total;
  return { cas, cass, impozit, total, net };
}

/* ─── row helpers ───────────────────────────────────────────── */
function Row({
  label,
  value,
  sub,
  positive,
  negative,
  big,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  negative?: boolean;
  big?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between py-2 ${big ? "border-t border-border mt-1" : ""}`}
    >
      <span
        className={`text-sm ${big ? "font-semibold text-foreground" : "text-muted-foreground"}`}
      >
        {label}
        {sub && (
          <span className="ml-2 text-xs text-muted-foreground/70">{sub}</span>
        )}
      </span>
      <span
        className={`font-mono text-sm font-semibold tabular-nums ${
          big
            ? "text-base text-foreground"
            : positive
              ? "text-green-600 dark:text-green-400"
              : negative
                ? "text-red-500"
                : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </div>
  );
}

function fmt(v: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(v);
}

/* ─── main component ────────────────────────────────────────── */
export async function DriverFinancialReport({
  driverId,
  salaryType,
  salaryPerKm,
  grossPercent,
  salaryFixedAmount,
  commissionRate,
  taxCas,
  taxCass,
  taxImpozit,
  period,
  companyCurrency = "USD",
}: {
  driverId: string;
  salaryType?: string | null;
  salaryPerKm: number | null;
  grossPercent?: number | null;
  salaryFixedAmount?: number | null;
  commissionRate: number | null;
  taxCas?: number | null;
  taxCass?: number | null;
  taxImpozit?: number | null;
  period: string;
  companyCurrency?: string;
}) {
  const { from, to, periodKey } = getPeriodRange(period);

  // 1. Loads livrate
  const loads = await prisma.load.findMany({
    where: {
      driverId,
      pickupDate: { gte: from, lte: to },
      status: { in: ["DELIVERED", "POD_UPLOADED", "INVOICED", "PAID"] },
    },
    select: {
      price: true,
      currency: true,
      actualDistanceKm: true,
      estimatedDistanceKm: true,
    },
  });

  // 2. Fuel entries
  const fuelAgg = await prisma.fuelEntry.aggregate({
    where: { driverId, occurredAt: { gte: from, lte: to } },
    _sum: { totalAmount: true },
    _count: true,
  });

  // 3. Expenses by type — only DRIVER-charged ones affect driver deductions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expensesRaw: any[] = await prisma.expense.findMany({
    where: { driverId, occurredAt: { gte: from, lte: to }, status: "APPROVED" },
  });
  const expensesDriver = expensesRaw.filter((e) => e.chargedTo === "DRIVER");

  const expenseMap: Record<string, number> = {};
  for (const e of expensesDriver)
    expenseMap[e.type] = (expenseMap[e.type] ?? 0) + e.amount;

  // 4. Permits (trucks driven in loads in period)
  const truckIds = await prisma.load.findMany({
    where: { driverId, pickupDate: { gte: from, lte: to } },
    select: { truckId: true },
  });
  const uniqueTruckIds = [
    ...new Set(truckIds.map((l) => l.truckId).filter(Boolean)),
  ] as string[];
  const permitsAgg = uniqueTruckIds.length
    ? await prisma.truckPermit.aggregate({
        where: {
          truckId: { in: uniqueTruckIds },
          validFrom: { gte: from, lte: to },
        },
        _sum: { cost: true },
      })
    : null;

  // 5. Maintenance (trucks driven)
  const maintAgg = uniqueTruckIds.length
    ? await prisma.maintenance.aggregate({
        where: {
          truckId: { in: uniqueTruckIds },
          completedAt: { gte: from, lte: to },
        },
        _sum: { cost: true },
      })
    : null;

  // 6. Manual adjustments (bonuses / deductions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adjustments: any[] = await (prisma as any).driverAdjustment.findMany({
    where: { driverProfileId: driverId, periodKey },
    orderBy: { createdAt: "asc" },
  });
  const adjustmentsTotal = adjustments.reduce(
    (s: number, a: { amount: number }) => s + a.amount,
    0,
  );

  // ── calculations ──────────────────────────────────────────────
  const revenue = loads.reduce((s, l) => s + l.price, 0);
  const totalKm = loads.reduce(
    (s, l) => s + (l.actualDistanceKm ?? l.estimatedDistanceKm ?? 0),
    0,
  );
  const fuelCost = fuelAgg._sum.totalAmount ?? 0;
  const permitsCost = permitsAgg?._sum.cost ?? 0;
  const maintCost = maintAgg?._sum.cost ?? 0;

  const tollCost = expenseMap["TOLL"] ?? 0;
  const parkingCost = expenseMap["PARKING"] ?? 0;
  const repairCost = expenseMap["REPAIR"] ?? 0;
  const otherCost =
    (expenseMap["OTHER"] ?? 0) +
    (expenseMap["COMMISSION"] ?? 0) +
    (expenseMap["INSURANCE"] ?? 0);

  const totalDeductions =
    fuelCost +
    permitsCost +
    maintCost +
    tollCost +
    parkingCost +
    repairCost +
    otherCost;
  const netContribution = revenue - totalDeductions;

  // Salary — branch by type
  const type = salaryType ?? "PER_MI";
  let baseSalary = 0;
  if (type === "PERCENT_GROSS") {
    baseSalary = grossPercent ? revenue * (grossPercent / 100) : 0;
  } else if (type === "FIXED") {
    baseSalary = salaryFixedAmount ?? 0;
  } else if (type === "FIXED_WEEKLY") {
    const msInPeriod = to.getTime() - from.getTime();
    const weeksInPeriod = Math.max(
      1,
      Math.round(msInPeriod / (7 * 24 * 3600 * 1000)),
    );
    baseSalary = (salaryFixedAmount ?? 0) * weeksInPeriod;
  } else {
    baseSalary = salaryPerKm ? totalKm * salaryPerKm : 0;
  }
  const commission =
    type === "PER_MI" && commissionRate ? revenue * (commissionRate / 100) : 0;
  const brutSalary = baseSalary + commission + adjustmentsTotal;
  const taxes = calcTaxes(
    Math.max(0, brutSalary),
    taxCas ?? 25,
    taxCass ?? 10,
    taxImpozit ?? 10,
  );

  const currency = loads[0]?.currency ?? companyCurrency;

  return (
    <div className="space-y-4">
      {/* KPI summary bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Loads delivered",
            value: String(loads.length),
            icon: TrendingUp,
            color: "text-blue-500",
          },
          {
            label: "Gross revenue",
            value: fmt(revenue, currency),
            icon: DollarSign,
            color: "text-green-500",
          },
          {
            label: "Distance",
            value: `${Math.round(totalKm).toLocaleString("en-US")} mi`,
            icon: TrendingUp,
            color: "text-purple-500",
          },
          {
            label: "Net salary",
            value: fmt(taxes.net, currency),
            icon: Calculator,
            color: "text-amber-500",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-lg border border-border bg-card p-4"
          >
            <k.icon className={`mb-1 h-4 w-4 ${k.color}`} />
            <div className="text-lg font-bold text-foreground">{k.value}</div>
            <div className="text-xs text-muted-foreground">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue & deductions */}
        <div className="lg:col-span-2 space-y-3">
          <Section title="Revenue" icon={TrendingUp}>
            <Row
              label="Loads delivered"
              value={fmt(revenue, currency)}
              sub={`${loads.length} loads`}
              positive
            />
            <Row
              label="Total revenue"
              value={fmt(revenue, currency)}
              big
              positive
            />
          </Section>

          <Section title="Expenses & Deductions" icon={TrendingDown}>
            {fuelCost > 0 && (
              <Row
                label="Fuel"
                value={`-${fmt(fuelCost, currency)}`}
                sub={`${fuelAgg._count} entries`}
                negative
              />
            )}
            {tollCost > 0 && (
              <Row
                label="Tolls / Bridge"
                value={`-${fmt(tollCost, currency)}`}
                negative
              />
            )}
            {parkingCost > 0 && (
              <Row
                label="Parking"
                value={`-${fmt(parkingCost, currency)}`}
                negative
              />
            )}
            {repairCost > 0 && (
              <Row
                label="Repairs"
                value={`-${fmt(repairCost, currency)}`}
                negative
              />
            )}
            {maintCost > 0 && (
              <Row
                label="Maintenance"
                value={`-${fmt(maintCost, currency)}`}
                negative
              />
            )}
            {permitsCost > 0 && (
              <Row
                label="Special permits"
                value={`-${fmt(permitsCost, currency)}`}
                negative
              />
            )}
            {otherCost > 0 && (
              <Row
                label="Other expenses"
                value={`-${fmt(otherCost, currency)}`}
                negative
              />
            )}
            {totalDeductions === 0 && (
              <p className="py-2 text-sm text-muted-foreground">
                No expenses recorded in this period.
              </p>
            )}
            <Row
              label="Total deductions"
              value={`-${fmt(totalDeductions, currency)}`}
              big
              negative
            />
          </Section>

          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-foreground">
                Net contribution
              </span>
              <span
                className={`font-mono text-xl font-bold ${netContribution >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}
              >
                {fmt(netContribution, currency)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Revenue – Total expenses
            </p>
          </div>
        </div>

        {/* Salary & taxes */}
        <div className="space-y-3">
          <Section title="Salary Calculation" icon={Calculator}>
            <Row
              label="Distance driven"
              value={`${Math.round(totalKm).toLocaleString("en-US")} mi`}
            />
            {(type === "PER_MI" || !salaryType) && (
              <Row
                label={`Rate per mile (${currency}/mi)`}
                value={salaryPerKm ? `${salaryPerKm} ${currency}/mi` : "—"}
              />
            )}
            {type === "PERCENT_GROSS" && (
              <Row
                label={`% of Gross (${grossPercent ?? 0}%)`}
                value={fmt(baseSalary, currency)}
                sub={`of ${fmt(revenue, currency)}`}
              />
            )}
            {type === "FIXED" && (
              <Row
                label="Fixed salary (monthly)"
                value={fmt(baseSalary, currency)}
              />
            )}
            {type === "FIXED_WEEKLY" && (
              <Row
                label={`Fixed salary (weekly × ${Math.max(1, Math.round((to.getTime() - from.getTime()) / (7 * 24 * 3600 * 1000)))} wk)`}
                value={fmt(baseSalary, currency)}
              />
            )}
            <Row label="Base salary" value={fmt(baseSalary, currency)} />
            {type === "PER_MI" &&
              commissionRate != null &&
              commissionRate > 0 && (
                <Row
                  label={`Commission (${commissionRate}%)`}
                  value={fmt(commission, currency)}
                  sub={`of ${fmt(revenue, currency)}`}
                />
              )}
            {adjustments
              .filter((a) => a.amount > 0)
              .map((a) => (
                <Row
                  key={a.id}
                  label={a.label}
                  value={`+${fmt(a.amount, currency)}`}
                  positive
                />
              ))}
            {adjustments
              .filter((a) => a.amount < 0)
              .map((a) => (
                <Row
                  key={a.id}
                  label={a.label}
                  value={`-${fmt(a.amount, currency)}`}
                  negative
                />
              ))}
            <Row label="GROSS salary" value={fmt(brutSalary, currency)} big />
          </Section>

          {(taxCas != null || taxCass != null || taxImpozit != null) && (
          <Section title="Taxes (RO)" icon={Receipt}>
            <Row
              label={`Employee pension (${taxCas ?? 25}%)`}
              value={`-${fmt(taxes.cas, currency)}`}
              negative
            />
            <Row
              label={`Employee health (${taxCass ?? 10}%)`}
              value={`-${fmt(taxes.cass, currency)}`}
              negative
            />
            <Row
              label={`Income tax (${taxImpozit ?? 10}%)`}
              value={`-${fmt(taxes.impozit, currency)}`}
              negative
            />
            <Row
              label="Total taxes"
              value={`-${fmt(taxes.total, currency)}`}
              big
              negative
            />
          </Section>
          )}

          <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-foreground">NET salary</span>
              <span className="font-mono text-xl font-bold text-green-600 dark:text-green-400">
                {fmt(taxes.net, currency)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Gross – Pension – Health – Income tax
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
