import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getDriverFinancialData } from "@/lib/driver-report";
import { getCompanyCurrency } from "@/lib/company-context";
import { PrintButton } from "@/components/drivers/print-button";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function R({
  label,
  value,
  neg,
  bold,
}: {
  label: string;
  value: string;
  neg?: boolean;
  bold?: boolean;
}) {
  return (
    <tr className={bold ? "border-t-2 border-border font-bold" : ""}>
      <td className="py-1 pr-4 text-sm text-muted-foreground">{label}</td>
      <td
        className={`py-1 text-right font-mono text-sm ${neg ? "text-red-500 dark:text-red-400" : "text-foreground"}`}
      >
        {value}
      </td>
    </tr>
  );
}

export default async function DriverReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const me = await requirePermission("drivers:read");
  const { id } = await params;
  const { period = "month" } = await searchParams;

  const driver = await prisma.driverProfile.findFirst({
    where: { id, companyId: me.companyId ?? undefined },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!driver) notFound();

  const data = await getDriverFinancialData(
    driver.id,
    driver.salaryType,
    driver.salaryPerKm,
    driver.grossPercent,
    driver.salaryFixedAmount,
    driver.commissionRate,
    (driver as { taxCas?: number | null }).taxCas ?? null,
    (driver as { taxCass?: number | null }).taxCass ?? null,
    (driver as { taxImpozit?: number | null }).taxImpozit ?? null,
    period,
    await getCompanyCurrency(me.companyId),
  );
  const { loads, fmt, fmtDate, adjustments } = data;
  const fullName = `${driver.firstName} ${driver.lastName}`;

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-8 px-3 sm:px-6 py-4 sm:py-8 print:px-0 print:py-0">
      {/* Toolbar hidden on print */}
      <div className="flex items-center justify-between gap-2 print:hidden">
        <Link
          href={`/admin/drivers/${id}?period=${period}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Back</span>
        </Link>
        <PrintButton />
      </div>

      {/* Header */}
      <div className="border-b-2 border-foreground pb-3 sm:pb-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
              {fullName}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {driver.user.email}
            </p>
          </div>
          <div className="sm:text-right mt-1 sm:mt-0">
            <div className="text-base sm:text-lg font-semibold text-foreground">
              Financial Report
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {data.periodLabel}
            </div>
            <div className="text-xs text-muted-foreground">
              Generated:{" "}
              {new Date().toLocaleDateString("en-US", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPIs — 2×2 on mobile, 4 cols on sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        {[
          { label: "Loads", value: String(loads.length) },
          { label: "Gross revenue", value: fmt(data.revenue, data.currency) },
          {
            label: "Distance",
            value: `${Math.round(data.totalKm).toLocaleString("en-US")} Mi`,
          },
          { label: "Net salary", value: fmt(data.taxes.net) },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded border border-border p-2.5 sm:p-3"
          >
            <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
              {k.label}
            </div>
            <div className="text-base sm:text-lg font-bold text-foreground mt-0.5 truncate">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Loads — card list on mobile, table on sm+ */}
      <div>
        <h2 className="mb-2 sm:mb-3 text-sm sm:text-base font-bold text-foreground">
          Loads ({loads.length})
        </h2>

        {/* Mobile card list */}
        {loads.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No loads in this period
          </p>
        ) : (
          <>
            <div className="flex flex-col divide-y border rounded sm:hidden">
              {loads.map((l) => (
                <div key={l.id} className="px-3 py-2.5 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold">
                      {l.referenceNumber}
                    </span>
                    <span className="font-semibold text-xs tabular-nums">
                      {fmt(l.price, l.currency)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {l.pickupCity ?? l.pickupAddress.slice(0, 20)} →{" "}
                    {l.deliveryCity ?? l.deliveryAddress.slice(0, 20)}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      {fmtDate(l.pickupDate)} → {fmtDate(l.deliveryDate)}
                    </span>
                    <span>
                      {Math.round(
                        l.actualDistanceKm ?? l.estimatedDistanceKm ?? 0,
                      ).toLocaleString("en-US")}{" "}
                      Mi
                    </span>
                  </div>
                  {(l.customer?.name || l.truck?.plateNumber) && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {l.customer?.name && <span>{l.customer.name}</span>}
                      {l.truck?.plateNumber && (
                        <span className="font-mono">{l.truck.plateNumber}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div className="px-3 py-2 bg-muted/40 flex items-center justify-between font-bold text-sm">
                <span>TOTAL ({loads.length} loads)</span>
                <span>{fmt(data.revenue, data.currency)}</span>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "16%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3">Ref. No.</th>
                    <th className="pb-2 pr-3">Pickup</th>
                    <th className="pb-2 pr-3">Delivery</th>
                    <th className="pb-2 pr-3">Customer</th>
                    <th className="pb-2 pr-3">Truck</th>
                    <th className="pb-2 pr-6 text-right">Mi</th>
                    <th className="pb-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {loads.map((l, i) => (
                    <tr
                      key={l.id}
                      className={`border-b border-border ${i % 2 === 0 ? "" : "bg-muted/50"}`}
                    >
                      <td className="py-1.5 pr-3 font-mono text-xs">
                        {l.referenceNumber}
                      </td>
                      <td className="py-1.5 pr-3">
                        <div className="font-medium">
                          {l.pickupCity ?? l.pickupAddress.slice(0, 25)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDate(l.pickupDate)}
                        </div>
                      </td>
                      <td className="py-1.5 pr-3">
                        <div className="font-medium">
                          {l.deliveryCity ?? l.deliveryAddress.slice(0, 25)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDate(l.deliveryDate)}
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 text-sm">
                        {l.customer?.name ?? "-"}
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-xs">
                        {l.truck?.plateNumber ?? "-"}
                      </td>
                      <td className="py-1.5 pr-6 text-right tabular-nums whitespace-nowrap">
                        {Math.round(
                          l.actualDistanceKm ?? l.estimatedDistanceKm ?? 0,
                        ).toLocaleString("en-US")}
                      </td>
                      <td className="py-1.5 text-right tabular-nums font-semibold whitespace-nowrap">
                        {fmt(l.price, l.currency)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-bold">
                    <td colSpan={5} className="py-2 text-sm">
                      TOTAL
                    </td>
                    <td className="py-2 pr-6 text-right tabular-nums whitespace-nowrap">
                      {Math.round(data.totalKm).toLocaleString("en-US")}
                    </td>
                    <td className="py-2 text-right tabular-nums whitespace-nowrap">
                      {fmt(data.revenue, data.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Financial breakdown — stacked on mobile, side-by-side on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
        <div>
          <h2 className="mb-2 sm:mb-3 text-sm sm:text-base font-bold text-foreground">
            Expenses &amp; Deductions
          </h2>
          <table className="w-full border-collapse">
            <tbody>
              <R
                label="Total revenue"
                value={fmt(data.revenue, data.currency)}
              />
              <tr>
                <td colSpan={2} className="py-1 border-b border-border" />
              </tr>
              {data.fuelCost > 0 && (
                <R
                  label={`Fuel (${data.fuelCount} entries)`}
                  value={`- ${fmt(data.fuelCost, data.currency)}`}
                  neg
                />
              )}
              {data.tollCost > 0 && (
                <R
                  label="Tolls / Bridge"
                  value={`- ${fmt(data.tollCost, data.currency)}`}
                  neg
                />
              )}
              {data.parkingCost > 0 && (
                <R
                  label="Parking"
                  value={`- ${fmt(data.parkingCost, data.currency)}`}
                  neg
                />
              )}
              {data.repairCost > 0 && (
                <R
                  label="Repairs"
                  value={`- ${fmt(data.repairCost, data.currency)}`}
                  neg
                />
              )}
              {data.maintCost > 0 && (
                <R
                  label="Maintenance"
                  value={`- ${fmt(data.maintCost, data.currency)}`}
                  neg
                />
              )}
              {data.permitsCost > 0 && (
                <R
                  label="Special permits"
                  value={`- ${fmt(data.permitsCost, data.currency)}`}
                  neg
                />
              )}
              {data.otherCost > 0 && (
                <R
                  label="Other expenses"
                  value={`- ${fmt(data.otherCost, data.currency)}`}
                  neg
                />
              )}
              {data.totalDeductions === 0 && (
                <R label="No expenses" value="-" />
              )}
              <R
                label="Total deductions"
                value={`- ${fmt(data.totalDeductions, data.currency)}`}
                neg
                bold
              />
              <tr>
                <td colSpan={2} className="py-1" />
              </tr>
              <R
                label="Net contribution"
                value={fmt(data.netContribution, data.currency)}
                bold
              />
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="mb-2 sm:mb-3 text-sm sm:text-base font-bold text-foreground">
            Salary &amp; Tax Breakdown
          </h2>
          <table className="w-full border-collapse">
            <tbody>
              <R
                label="Distance driven"
                value={`${Math.round(data.totalKm).toLocaleString("en-US")} Mi`}
              />
              <R
                label={`Rate ${data.currency}/Mi`}
                value={
                  driver.salaryPerKm
                    ? `${driver.salaryPerKm} ${data.currency}/Mi`
                    : "-"
                }
              />
              <R
                label="Base salary"
                value={fmt(data.baseSalary, data.currency)}
              />
              {driver.commissionRate && driver.commissionRate > 0 && (
                <R
                  label={`Commission (${driver.commissionRate}%)`}
                  value={fmt(data.commission)}
                />
              )}
              {adjustments
                .filter((a) => a.amount > 0)
                .map((a) => (
                  <R key={a.id} label={`+ ${a.label}`} value={fmt(a.amount)} />
                ))}
              {adjustments
                .filter((a) => a.amount < 0)
                .map((a) => (
                  <R
                    key={a.id}
                    label={`– ${a.label}`}
                    value={`- ${fmt(Math.abs(a.amount))}`}
                    neg
                  />
                ))}
              <R label="GROSS salary" value={fmt(data.brutSalary)} bold />
              <tr>
                <td colSpan={2} className="py-1 border-b border-border" />
              </tr>
              <R
                label={`Employee pension (${data.taxRates.cas}%)`}
                value={`- ${fmt(data.taxes.cas)}`}
                neg
              />
              <R
                label={`Employee health ins. (${data.taxRates.cass}%)`}
                value={`- ${fmt(data.taxes.cass)}`}
                neg
              />
              <R
                label={`Income tax (${data.taxRates.impozit}%)`}
                value={`- ${fmt(data.taxes.impozit)}`}
                neg
              />
              <R
                label="Total taxes"
                value={`- ${fmt(data.taxes.total)}`}
                neg
                bold
              />
              <tr>
                <td colSpan={2} className="py-1" />
              </tr>
              <R label="NET SALARY PAYABLE" value={fmt(data.taxes.net)} bold />
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border pt-3 sm:pt-4 text-xs text-muted-foreground">
        <p>
          Report auto-generated by TMS &mdash; {fullName} &mdash;{" "}
          {data.periodLabel}
        </p>
        <p className="mt-1">
          Taxes calculated per Romanian law: Pension 25% + Health Ins. 10% +
          Income Tax 10% of (Gross &minus; Pension &minus; Health Ins.).
        </p>
      </div>

      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          html, body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white !important;
            color: #111827 !important;
            color-scheme: light !important;
            overflow: visible !important;
            height: auto !important;
          }
          body > * { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}
