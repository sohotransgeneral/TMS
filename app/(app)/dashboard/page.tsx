import { Suspense } from "react";
import {
  Truck,
  Package,
  Users,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { getCompanyCurrency } from "@/lib/company-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { defaultDashboardFor, ROLE_LABELS } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard" };

async function getOverview(companyId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const in30days = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  const [
    activeLoads,
    completedLoadsThisMonth,
    availableTrucks,
    availableDrivers,
    monthlyInvoices,
    monthlyExpenses,
    expiringDocs,
    recentLoads,
  ] = await Promise.all([
    prisma.load.count({
      where: {
        companyId,
        status: {
          in: [
            "ASSIGNED",
            "DRIVER_ACCEPTED",
            "ON_WAY_TO_PICKUP",
            "AT_PICKUP",
            "LOADED",
            "IN_TRANSIT",
            "AT_DELIVERY",
          ],
        },
      },
    }),
    prisma.load.count({
      where: {
        companyId,
        status: { in: ["DELIVERED", "POD_UPLOADED", "INVOICED", "PAID"] },
        updatedAt: { gte: startOfMonth },
      },
    }),
    prisma.truck.count({ where: { companyId, status: "AVAILABLE" } }),
    prisma.driverProfile.count({ where: { companyId, status: "AVAILABLE" } }),
    prisma.invoice.aggregate({
      where: { companyId, issueDate: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    prisma.expense.aggregate({
      where: {
        companyId,
        occurredAt: { gte: startOfMonth },
        status: "APPROVED",
      },
      _sum: { amount: true },
    }),
    prisma.document.count({
      where: {
        companyId,
        expiresAt: { lte: in30days, gte: now },
      },
    }),
    prisma.load.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        customer: { select: { name: true } },
        driver: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const revenue = monthlyInvoices._sum.total ?? 0;
  const expenses = monthlyExpenses._sum.amount ?? 0;

  return {
    activeLoads,
    completedLoadsThisMonth,
    availableTrucks,
    availableDrivers,
    revenue,
    expenses,
    profit: revenue - expenses,
    expiringDocs,
    recentLoads,
  };
}

const STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "info" | "secondary"
> = {
  DRAFT: "secondary",
  ASSIGNED: "info",
  DRIVER_ACCEPTED: "info",
  ON_WAY_TO_PICKUP: "info",
  AT_PICKUP: "warning",
  LOADED: "warning",
  IN_TRANSIT: "info",
  AT_DELIVERY: "warning",
  DELIVERED: "success",
  POD_UPLOADED: "success",
  INVOICED: "success",
  PAID: "success",
  CANCELLED: "destructive",
};

export default async function DashboardPage() {
  const user = await requireUser();

  // Drivers and customers get their own dashboards
  if (user.role === "DRIVER") redirect(defaultDashboardFor("DRIVER"));
  if (user.role === "CUSTOMER") redirect("/customer/loads");

  if (!user.companyId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            Your account is not associated with a company. Please contact the
            administrator.
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = await getOverview(user.companyId);
  const currency = await getCompanyCurrency(user.companyId);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">
            Hello, {user.name ?? "User"}!
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {ROLE_LABELS[user.role]} · Overview for the current month
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Loads"
          value={data.activeLoads}
          icon={Package}
          tone="info"
        />
        <StatCard
          label="Completed (month)"
          value={data.completedLoadsThisMonth}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Trucks available"
          value={data.availableTrucks}
          icon={Truck}
        />
        <StatCard
          label="Drivers available"
          value={data.availableDrivers}
          icon={Users}
        />
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly Revenue"
          value={formatCurrency(data.revenue, currency)}
          icon={DollarSign}
          tone="success"
        />
        <StatCard
          label="Monthly Expenses"
          value={formatCurrency(data.expenses, currency)}
          icon={Wallet}
          tone="warning"
        />
        <StatCard
          label="Est. Profit"
          value={formatCurrency(data.profit, currency)}
          icon={TrendingUp}
          tone={data.profit >= 0 ? "success" : "destructive"}
        />
        <StatCard
          label="Docs expiring ≤ 30d"
          value={data.expiringDocs}
          icon={AlertTriangle}
          tone={data.expiringDocs > 0 ? "warning" : "default"}
        />
      </div>

      <Card>
        <CardHeader className="pb-2 px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg">Recent Loads</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6 pb-0">
          {data.recentLoads.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 sm:px-0 pb-4">
              No loads recorded yet.
            </p>
          ) : (
            <Suspense>
              {/* Mobile: card list */}
              <div className="flex flex-col divide-y sm:hidden">
                {data.recentLoads.map((l) => (
                  <div key={l.id} className="px-4 py-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">
                        {l.referenceNumber}
                      </span>
                      <Badge
                        variant={STATUS_VARIANT[l.status] ?? "default"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {l.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {l.pickupCity ?? l.pickupAddress} →{" "}
                      {l.deliveryCity ?? l.deliveryAddress}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {l.driver
                          ? `${l.driver.firstName} ${l.driver.lastName}`
                          : "No driver"}
                      </span>
                      <span className="text-xs font-medium">
                        {formatCurrency(l.price, l.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: table */}
              <div className="hidden sm:block">
                <Table>
                  <THead>
                    <TR>
                      <TH>Reference</TH>
                      <TH>Customer</TH>
                      <TH>Route</TH>
                      <TH>Driver</TH>
                      <TH>Status</TH>
                      <TH className="text-right">Price</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.recentLoads.map((l) => (
                      <TR key={l.id}>
                        <TD className="font-medium">{l.referenceNumber}</TD>
                        <TD>{l.customer?.name ?? "—"}</TD>
                        <TD className="max-w-[280px] truncate">
                          {l.pickupCity ?? l.pickupAddress} →{" "}
                          {l.deliveryCity ?? l.deliveryAddress}
                        </TD>
                        <TD>
                          {l.driver
                            ? `${l.driver.firstName} ${l.driver.lastName}`
                            : "—"}
                        </TD>
                        <TD>
                          <Badge
                            variant={STATUS_VARIANT[l.status] ?? "default"}
                          >
                            {l.status.replace(/_/g, " ")}
                          </Badge>
                        </TD>
                        <TD className="text-right font-medium">
                          {formatCurrency(l.price, l.currency)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </Suspense>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
