import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getPeriodRange } from "@/lib/period";
import { loadTotal } from "@/lib/accessorials";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { PeriodSelector } from "@/components/drivers/period-selector";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
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
import { Users, Package, DollarSign, Percent } from "lucide-react";

export const metadata = { title: "Dispatcher Commissions" };

/**
 * What each dispatcher booked in a period and what they earn from it.
 *
 * Commission is recomputed here from the dispatcher's current percentage
 * rather than read off the load — the rule chosen for this feature is that
 * changing someone's rate re-values their earlier loads too.
 *
 * Loads are counted by pickup date, the same basis as the driver report, so
 * the two never disagree about which period a trip belongs to.
 */
export default async function DispatcherCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; dispatcher?: string }>;
}) {
  const me = await requirePermission("reports:read");
  const { period = "month", dispatcher: selectedId } = await searchParams;
  const { from, to, label } = getPeriodRange(period);

  const companyId = me.companyId ?? undefined;

  const [dispatchers, loads] = await Promise.all([
    prisma.user.findMany({
      where: { companyId, role: { in: ["DISPATCHER", "COMPANY_ADMIN"] } },
      select: { id: true, name: true, email: true, commissionPercent: true },
      orderBy: { name: "asc" },
    }),
    prisma.load.findMany({
      where: {
        companyId,
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
        dispatcherId: true,
        customer: { select: { name: true } },
      },
    }),
  ]);

  const currency = loads[0]?.currency ?? "USD";

  const rows = dispatchers.map((d) => {
    const own = loads.filter((l) => l.dispatcherId === d.id);
    const revenue = own.reduce((sum, l) => sum + loadTotal(l), 0);
    const percent = d.commissionPercent ?? 0;
    return { ...d, loads: own, revenue, commission: (revenue * percent) / 100 };
  });

  // Loads whose dispatcher has left, or that predate dispatcher tracking,
  // would otherwise disappear from the totals with no explanation.
  const orphaned = loads.filter(
    (l) => !dispatchers.some((d) => d.id === l.dispatcherId),
  );

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
  const totalLoads = rows.reduce((s, r) => s + r.loads.length, 0);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatcher Commissions"
        description={`Loads booked and commission earned — ${label}.`}
      />

      <PeriodSelector />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Dispatchers"
          value={String(rows.length)}
          icon={Users}
        />
        <StatCard
          label="Loads booked"
          value={String(totalLoads)}
          icon={Package}
        />
        <StatCard
          label="Revenue booked"
          value={formatCurrency(totalRevenue, currency)}
          icon={DollarSign}
        />
        <StatCard
          label="Commission owed"
          value={formatCurrency(totalCommission, currency)}
          icon={Percent}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No dispatchers"
            description="Add a user with the Dispatcher role to track commissions."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dispatcher</TableHead>
                <TableHead className="w-24 text-right">Rate</TableHead>
                <TableHead className="w-24 text-right">Loads</TableHead>
                <TableHead className="w-36 text-right">Revenue</TableHead>
                <TableHead className="w-36 text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.id}
                  className={selectedId === r.id ? "bg-muted/50" : undefined}
                >
                  <TableCell>
                    <Link
                      href={`/admin/dispatchers?period=${encodeURIComponent(period)}&dispatcher=${r.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.name ?? r.email}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {r.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.commissionPercent != null ? (
                      `${r.commissionPercent}%`
                    ) : (
                      <span className="text-muted-foreground">not set</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.loads.length}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(r.revenue, currency)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {r.commissionPercent != null ? (
                      formatCurrency(r.commission, currency)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {orphaned.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {orphaned.length} load{orphaned.length > 1 ? "s" : ""} in this period
          {orphaned.length > 1 ? " have" : " has"} no dispatcher on record, so
          {orphaned.length > 1 ? " they are" : " it is"} not counted above.
        </p>
      )}

      {selected && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            {selected.name ?? selected.email} — {selected.loads.length} load
            {selected.loads.length === 1 ? "" : "s"}
          </h2>
          <div className="overflow-x-auto rounded-lg border bg-card">
            {selected.loads.length === 0 ? (
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
                    <TableHead className="w-32 text-right">
                      Commission
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.loads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono">
                        <LoadRefLink
                          id={l.id}
                          referenceNumber={l.referenceNumber}
                        />
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
                        {selected.commissionPercent != null
                          ? formatCurrency(
                              (loadTotal(l) * selected.commissionPercent) / 100,
                              l.currency,
                            )
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
