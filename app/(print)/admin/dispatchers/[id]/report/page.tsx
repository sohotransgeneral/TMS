import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getPeriodRange } from "@/lib/period";
import { loadTotal } from "@/lib/accessorials";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PrintButton } from "@/components/drivers/print-button";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dispatcher report" };

/**
 * Printable commission statement — what gets sent to the dispatcher.
 *
 * Deliberately a page rather than a generated PDF: it prints to PDF from the
 * browser, stays readable on a phone, and needs no font embedding for the
 * amounts and names.
 */
export default async function DispatcherReportPage({
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
    where: { id, ...(me.companyId ? { companyId: me.companyId } : {}) },
    select: {
      name: true,
      email: true,
      phone: true,
      commissionPercent: true,
      company: { select: { name: true, currency: true } },
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
      orderBy: { pickupDate: "asc" },
      select: {
        id: true,
        referenceNumber: true,
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
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const currency = dispatcher.company?.currency ?? loads[0]?.currency ?? "USD";
  const percent = dispatcher.commissionPercent ?? 0;
  const revenue = loads.reduce((s, l) => s + loadTotal(l), 0);
  const commission = (revenue * percent) / 100;
  const adjustmentTotal = adjustments.reduce((s, a) => s + a.amount, 0);
  const payout = commission + adjustmentTotal;
  const outstanding =
    loads
      .filter((l) => l.dispatcherPaidAt == null)
      .reduce((s, l) => s + (loadTotal(l) * percent) / 100, 0) + adjustmentTotal;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/admin/dispatchers/${id}?period=${encodeURIComponent(period)}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <PrintButton />
      </div>

      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold">Dispatcher commission statement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {dispatcher.company?.name ?? ""} — {label}
        </p>
        <div className="mt-3 text-sm">
          <div className="font-medium">{dispatcher.name ?? dispatcher.email}</div>
          <div className="text-muted-foreground">
            {dispatcher.email}
            {dispatcher.phone ? ` · ${dispatcher.phone}` : ""}
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </h2>
        <table className="w-full">
          <tbody>
            <Row label="Loads booked" value={String(loads.length)} />
            <Row label="Revenue booked" value={formatCurrency(revenue, currency)} />
            <Row
              label={`Commission (${percent}%)`}
              value={formatCurrency(commission, currency)}
            />
            {adjustments.map((a) => (
              <Row
                key={a.id}
                label={a.label}
                value={`${a.amount < 0 ? "−" : "+"}${formatCurrency(Math.abs(a.amount), currency)}`}
                negative={a.amount < 0}
              />
            ))}
            <Row
              label="Total payout"
              value={formatCurrency(payout, currency)}
              bold
            />
            <Row
              label="Already paid"
              value={formatCurrency(payout - outstanding, currency)}
            />
            <Row
              label="Still owed"
              value={formatCurrency(outstanding, currency)}
              bold
            />
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Loads
        </h2>
        {loads.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No loads in this period.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-3">Nr</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Route</th>
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3 text-right">Total</th>
                <th className="py-2 pr-3 text-right">Commission</th>
                <th className="py-2 text-right">Paid</th>
              </tr>
            </thead>
            <tbody>
              {loads.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-3 font-mono">{l.referenceNumber}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {formatDate(l.pickupDate)}
                  </td>
                  <td className="py-1.5 pr-3">
                    {l.pickupCity ?? "—"} → {l.deliveryCity ?? "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {l.customer?.name ?? "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono">
                    {formatCurrency(loadTotal(l), l.currency)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono">
                    {formatCurrency((loadTotal(l) * percent) / 100, l.currency)}
                  </td>
                  <td className="py-1.5 text-right text-xs">
                    {l.dispatcherPaidAt ? "Paid" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="border-t pt-3 text-xs text-muted-foreground">
        Generated {formatDate(new Date(), true)}. Commission is {percent}% of
        each load total (rate + accessorials).
      </footer>
    </div>
  );
}

function Row({
  label,
  value,
  negative,
  bold,
}: {
  label: string;
  value: string;
  negative?: boolean;
  bold?: boolean;
}) {
  return (
    <tr className={bold ? "border-t-2 border-border font-bold" : ""}>
      <td className="py-1 pr-4 text-sm text-muted-foreground">{label}</td>
      <td
        className={`py-1 text-right font-mono text-sm ${negative ? "text-red-500 dark:text-red-400" : "text-foreground"}`}
      >
        {value}
      </td>
    </tr>
  );
}
