import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getPeriodRange } from "@/lib/period";
import { loadTotal } from "@/lib/accessorials";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { PeriodSelector } from "@/components/drivers/period-selector";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { DispatcherAdjustmentsPanel } from "@/components/dispatchers/dispatcher-adjustments-panel";
import {
  LoadStatusBadge,
  LoadRefLink,
} from "@/components/loads/load-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  DollarSign,
  Percent,
  Wallet,
  FileDown,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import {
  PaidToggle,
  SettleAllButton,
} from "@/components/dispatchers/commission-paid-controls";

export const metadata = { title: "Dispatcher" };

/**
 * One dispatcher's earnings for a period: the loads they booked, the
 * commission those produce at their current rate, and any bonuses or
 * deductions recorded against the period.
 */
export default async function DispatcherPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const me = await requirePermission("reports:read");
  const { id } = await params;
  const { period = "month" } = await searchParams;
  const { from, to, label, periodKey } = getPeriodRange(period);

  const dispatcher = await prisma.user.findFirst({
    where: {
      id,
      ...(me.companyId ? { companyId: me.companyId } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      commissionPercent: true,
      companyId: true,
    },
  });
  if (!dispatcher) notFound();

  const [loads, adjustments] = await Promise.all([
    prisma.load.findMany({
      where: {
        dispatcherId: id,
        pickupDate: { gte: from, lte: to },
        status: { not: "CANCELLED" },
      },
      orderBy: { pickupDate: "desc" },
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        price: true,
        accessorialAmount: true,
        currency: true,
        pickupDate: true,
        pickupCity: true,
        deliveryCity: true,
        dispatcherPaidAt: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.dispatcherAdjustment.findMany({
      where: { userId: id, periodKey },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const currency = loads[0]?.currency ?? "USD";
  const percent = dispatcher.commissionPercent ?? null;
  const revenue = loads.reduce((s, l) => s + loadTotal(l), 0);
  const commission = percent != null ? (revenue * percent) / 100 : 0;
  const adjustmentTotal = adjustments.reduce((s, a) => s + a.amount, 0);

  // Commission is settled load by load, so the outstanding figure is the one
  // that actually has to be transferred.
  const commissionOf = (l: (typeof loads)[number]) =>
    percent != null ? (loadTotal(l) * percent) / 100 : 0;
  const paidLoads = loads.filter((l) => l.dispatcherPaidAt != null);
  const unpaidLoads = loads.filter((l) => l.dispatcherPaidAt == null);
  const paidCommission = paidLoads.reduce((s, l) => s + commissionOf(l), 0);
  const outstanding = unpaidLoads.reduce((s, l) => s + commissionOf(l), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={dispatcher.name ?? dispatcher.email}
        description={`${dispatcher.email}${dispatcher.phone ? ` · ${dispatcher.phone}` : ""} — ${label}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/dispatchers">
                <ArrowLeft className="mr-2 h-4 w-4" /> All dispatchers
              </Link>
            </Button>
            <Button asChild>
              <Link
                href={`/admin/dispatchers/${id}/report?period=${encodeURIComponent(period)}`}
                target="_blank"
              >
                <FileDown className="mr-2 h-4 w-4" /> Report
              </Link>
            </Button>
          </div>
        }
      />

      <PeriodSelector />

      {percent == null && (
        <p className="rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          No commission rate set for this dispatcher, so the loads below earn
          nothing. Set one in Users.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Loads booked" value={String(loads.length)} icon={Package} />
        <StatCard
          label="Revenue booked"
          value={formatCurrency(revenue, currency)}
          icon={DollarSign}
        />
        <StatCard
          label={`Commission${percent != null ? ` (${percent}%)` : ""}`}
          value={formatCurrency(commission, currency)}
          icon={Percent}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(outstanding + adjustmentTotal, currency)}
          hint={`${paidLoads.length}/${loads.length} loads paid · ${formatCurrency(paidCommission, currency)} settled`}
          icon={outstanding + adjustmentTotal > 0 ? Wallet : CheckCircle2}
          tone={outstanding + adjustmentTotal > 0 ? "warning" : "success"}
        />
      </div>

      <DispatcherAdjustmentsPanel
        userId={id}
        periodKey={periodKey}
        periodLabel={label}
        currency={currency}
        adjustments={adjustments}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Loads — {loads.length} in {label}
          </h2>
          {percent != null && (
            <SettleAllButton
              dispatcherId={id}
              loadIds={unpaidLoads.map((l) => l.id)}
              outstandingCount={unpaidLoads.length}
              outstandingLabel={formatCurrency(outstanding, currency)}
            />
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border bg-card">
          {loads.length === 0 ? (
            <EmptyState
              icon={<Package className="h-10 w-10" />}
              title="No loads in this period"
              description="Pick a different period above."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Nr</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="w-28">Pickup</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Total</TableHead>
                  <TableHead className="w-32 text-right">Commission</TableHead>
                  <TableHead className="w-16 text-center">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono">
                      <LoadRefLink id={l.id} referenceNumber={l.referenceNumber} />
                    </TableCell>
                    <TableCell>
                      {l.pickupCity ?? "—"} → {l.deliveryCity ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.customer?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(l.pickupDate)}
                    </TableCell>
                    <TableCell>
                      <LoadStatusBadge status={l.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(loadTotal(l), l.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {percent != null
                        ? formatCurrency((loadTotal(l) * percent) / 100, l.currency)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <PaidToggle
                          loadId={l.id}
                          paid={l.dispatcherPaidAt != null}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
