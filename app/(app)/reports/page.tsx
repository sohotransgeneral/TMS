import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";

export const dynamic = "force-dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  MonthlyRevenueChart,
  LoadsPerDayChart,
  ExpensesByTypeChart,
  LoadsByStatusChart,
  FuelConsumptionChart,
} from "@/components/reports/charts";
import { ReportsFilters } from "@/components/reports/reports-filters";
import { EXPENSE_TYPE_LABELS } from "@/lib/validators/accounting";
import { TrendingUp, Package, Truck, Receipt, FileDown } from "lucide-react";

export const metadata = { title: "Reports" };

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function startOfMonth(y: number, m: number) {
  return new Date(y, m, 1);
}
function fmtMonth(d: Date) {
  return `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}
function fmtDay(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ driverId?: string; truckId?: string }>;
}) {
  const me = await requirePermission("reports:read");
  const companyId = me.companyId ?? undefined;
  const { driverId, truckId } = await searchParams;

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last12Start = startOfMonth(now.getFullYear(), now.getMonth() - 11);

  const [invoices, payments, loads, expenses, fuel, fleet, drivers, allTrucks] =
    await Promise.all([
      prisma.invoice.findMany({
        where: { companyId, issueDate: { gte: last12Start } },
        select: { issueDate: true, total: true },
      }),
      prisma.payment.findMany({
        where: { companyId, paidAt: { gte: last12Start } },
        select: { paidAt: true, amount: true },
      }),
      prisma.load.findMany({
        where: {
          companyId,
          createdAt: { gte: last30 },
          ...(driverId ? { driverId } : {}),
          ...(truckId ? { truckId } : {}),
        },
        select: { createdAt: true, status: true, price: true },
      }),
      prisma.expense.groupBy({
        by: ["type"],
        where: {
          companyId,
          occurredAt: { gte: yearStart },
          status: "APPROVED",
          ...(driverId ? { driverId } : {}),
          ...(truckId ? { truckId } : {}),
        },
        _sum: { amount: true },
      }),
      prisma.fuelEntry.findMany({
        where: {
          companyId,
          occurredAt: { gte: last12Start },
          ...(driverId ? { driverId } : {}),
          ...(truckId ? { truckId } : {}),
        },
        select: { occurredAt: true, liters: true, totalAmount: true },
      }),
      prisma.truck.aggregate({ where: { companyId }, _count: true }),
      prisma.driverProfile.findMany({
        where: { companyId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { firstName: "asc" },
      }),
      prisma.truck.findMany({
        where: { companyId },
        select: { id: true, plateNumber: true },
        orderBy: { plateNumber: "asc" },
      }),
    ]);
  const driverCount = drivers.length;

  // KPI year
  const totalInvoiced = invoices
    .filter((i) => i.issueDate >= yearStart)
    .reduce((s, i) => s + i.total, 0);
  const totalCollected = payments
    .filter((p) => p.paidAt >= yearStart)
    .reduce((s, p) => s + p.amount, 0);
  const totalLoads = loads.length;
  const totalExpenses = expenses.reduce((s, e) => s + (e._sum.amount ?? 0), 0);

  // Last 12 months: invoiced + collected
  const monthlyMap = new Map<string, { invoiced: number; collected: number }>();
  for (let i = 0; i < 12; i++) {
    const d = startOfMonth(now.getFullYear(), now.getMonth() - 11 + i);
    monthlyMap.set(fmtMonth(d), { invoiced: 0, collected: 0 });
  }
  invoices.forEach((i) => {
    const k = fmtMonth(i.issueDate);
    const v = monthlyMap.get(k);
    if (v) v.invoiced += i.total;
  });
  payments.forEach((p) => {
    const k = fmtMonth(p.paidAt);
    const v = monthlyMap.get(k);
    if (v) v.collected += p.amount;
  });
  const monthlyRevenue = Array.from(monthlyMap, ([month, v]) => ({
    month,
    ...v,
  }));

  // Loads per day (last 30)
  const dayMap = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - (29 - i) * 86_400_000);
    dayMap.set(fmtDay(d), 0);
  }
  loads.forEach((l) => {
    const k = fmtDay(l.createdAt);
    if (dayMap.has(k)) dayMap.set(k, (dayMap.get(k) ?? 0) + 1);
  });
  const loadsPerDay = Array.from(dayMap, ([day, count]) => ({ day, count }));

  // Loads by status
  const statusMap = new Map<string, number>();
  loads.forEach((l) =>
    statusMap.set(l.status, (statusMap.get(l.status) ?? 0) + 1),
  );
  const loadsByStatus = Array.from(statusMap, ([status, count]) => ({
    status,
    count,
  })).sort((a, b) => b.count - a.count);

  // Expenses by type
  const expensesByType = expenses
    .filter((e) => (e._sum.amount ?? 0) > 0)
    .map((e) => ({
      type:
        EXPENSE_TYPE_LABELS[e.type as keyof typeof EXPENSE_TYPE_LABELS] ??
        e.type,
      amount: e._sum.amount ?? 0,
    }));

  // Fuel monthly
  const fuelMap = new Map<string, { liters: number; amount: number }>();
  for (let i = 0; i < 12; i++) {
    const d = startOfMonth(now.getFullYear(), now.getMonth() - 11 + i);
    fuelMap.set(fmtMonth(d), { liters: 0, amount: 0 });
  }
  fuel.forEach((f) => {
    const k = fmtMonth(f.occurredAt);
    const v = fuelMap.get(k);
    if (v) {
      v.liters += f.liters;
      v.amount += f.totalAmount;
    }
  });
  const fuelByMonth = Array.from(fuelMap, ([month, v]) => ({ month, ...v }));

  const kpis = [
    {
      label: "Invoiced (YTD)",
      value: formatCurrency(totalInvoiced),
      sub: `${invoices.length} invoices`,
      icon: Receipt,
      color: "text-blue-600",
    },
    {
      label: "Collected (YTD)",
      value: formatCurrency(totalCollected),
      sub: `${payments.length} payments`,
      icon: TrendingUp,
      color: "text-emerald-600",
    },
    {
      label: "Loads (30 days)",
      value: totalLoads.toString(),
      sub: "loads created",
      icon: Package,
      color: "text-violet-600",
    },
    {
      label: "Fleet",
      value: `${fleet._count} trucks · ${driverCount} drivers`,
      sub: `expenses YTD ${formatCurrency(totalExpenses)}`,
      icon: Truck,
      color: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Operational and financial indicators."
        action={
          <a href="/api/reports/pdf" target="_blank" rel="noreferrer">
            <Button variant="outline">
              <FileDown className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </a>
        }
      />

      <Suspense fallback={null}>
        <ReportsFilters drivers={drivers} trucks={allTrucks} />
      </Suspense>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{k.label}</CardTitle>
                <Icon className={`h-4 w-4 ${k.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{k.value}</div>
                <p className="text-xs text-muted-foreground">{k.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invoiced vs Collected (12 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyRevenueChart data={monthlyRevenue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loads by Status (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadsByStatus.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No data.
              </p>
            ) : (
              <LoadsByStatusChart data={loadsByStatus} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Loads (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <LoadsPerDayChart data={loadsPerDay} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category (year)</CardTitle>
          </CardHeader>
          <CardContent>
            {expensesByType.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No approved expenses.
              </p>
            ) : (
              <ExpensesByTypeChart data={expensesByType} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Fuel by Month (12 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <FuelConsumptionChart data={fuelByMonth} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
