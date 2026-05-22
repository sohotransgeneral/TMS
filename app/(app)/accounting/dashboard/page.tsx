import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { ArrowRight, CreditCard, FileText, Fuel, Receipt } from "lucide-react";

export const metadata = { title: "Financial Overview" };

export default async function AccountingDashboard() {
  const me = await requirePermission("invoices:read");
  const companyId = me.companyId ?? undefined;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    invAggMonth,
    invAggYear,
    overdue,
    expensesMonth,
    fuelMonth,
    paymentsMonth,
    recentInvoices,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { companyId, issueDate: { gte: startOfMonth } },
      _sum: { total: true, paidAmount: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { companyId, issueDate: { gte: startOfYear } },
      _sum: { total: true, paidAmount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        companyId,
        status: { in: ["SENT", "OVERDUE"] },
        dueDate: { lt: now },
      },
      _sum: { total: true, paidAmount: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: {
        companyId,
        occurredAt: { gte: startOfMonth },
        status: "APPROVED",
      },
      _sum: { amount: true },
    }),
    prisma.fuelEntry.aggregate({
      where: { companyId, occurredAt: { gte: startOfMonth } },
      _sum: { totalAmount: true, liters: true },
    }),
    prisma.payment.aggregate({
      where: { companyId, paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { companyId },
      orderBy: { issueDate: "desc" },
      take: 5,
      include: { customer: { select: { name: true } } },
    }),
  ]);

  const overdueRemaining =
    (overdue._sum.total ?? 0) - (overdue._sum.paidAmount ?? 0);

  const cards = [
    {
      label: "Invoiced (month)",
      value: formatCurrency(invAggMonth._sum.total ?? 0),
      sub: `${invAggMonth._count} invoices`,
      icon: FileText,
      color: "text-blue-600",
    },
    {
      label: "Collected (month)",
      value: formatCurrency(paymentsMonth._sum.amount ?? 0),
      sub: "payments recorded",
      icon: CreditCard,
      color: "text-emerald-600",
    },
    {
      label: "Overdue",
      value: formatCurrency(Math.max(0, overdueRemaining)),
      sub: `${overdue._count} overdue invoices`,
      icon: Receipt,
      color: "text-rose-600",
    },
    {
      label: "Expenses (month)",
      value: formatCurrency(
        (expensesMonth._sum.amount ?? 0) + (fuelMonth._sum.totalAmount ?? 0),
      ),
      sub: `fuel + other`,
      icon: Fuel,
      color: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Overview"
        description={`This year: invoiced ${formatCurrency(invAggYear._sum.total ?? 0)} · collected ${formatCurrency(invAggYear._sum.paidAmount ?? 0)}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{c.value}</div>
                <p className="text-xs text-muted-foreground">{c.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Invoices</CardTitle>
            <Link
              href="/accounting/invoices"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No invoices issued yet.
            </p>
          ) : (
            <ul className="divide-y">
              {recentInvoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between py-3"
                >
                  <Link
                    href={`/accounting/invoices/${inv.id}`}
                    className="hover:underline"
                  >
                    <div className="font-medium">{inv.number}</div>
                    <div className="text-xs text-muted-foreground">
                      {inv.customer?.name ?? "—"}
                    </div>
                  </Link>
                  <div className="text-right">
                    <div className="font-medium">
                      {formatCurrency(inv.total, inv.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {inv.status}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
