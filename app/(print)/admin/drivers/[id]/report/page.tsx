import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getDriverFinancialData } from "@/lib/driver-report";
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
    <tr className={bold ? "border-t-2 border-gray-400 font-bold" : ""}>
      <td className="py-1 pr-4 text-sm text-gray-600">{label}</td>
      <td
        className={`py-1 text-right font-mono text-sm ${neg ? "text-red-600" : "text-gray-900"}`}
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
    period,
  );
  const { loads, fmt, fmtDate, adjustments } = data;
  const fullName = `${driver.firstName} ${driver.lastName}`;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-8 print:px-0 print:py-0">
      {/* Toolbar hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/admin/drivers/${id}?period=${period}`}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>
        <PrintButton />
      </div>

      {/* Header */}
      <div className="border-b-2 border-gray-900 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
            <p className="text-sm text-gray-500">{driver.user.email}</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-900">
              Financial Report
            </div>
            <div className="text-sm text-gray-600">{data.periodLabel}</div>
            <div className="text-xs text-gray-500">
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

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Loads delivered", value: String(loads.length) },
          { label: "Gross revenue", value: fmt(data.revenue, data.currency) },
          {
            label: "Distance",
            value: `${Math.round(data.totalKm).toLocaleString("en-US")} Mi`,
          },
          { label: "Net salary", value: fmt(data.taxes.net) },
        ].map((k) => (
          <div key={k.label} className="rounded border border-gray-300 p-3">
            <div className="text-xs text-gray-500">{k.label}</div>
            <div className="text-lg font-bold text-gray-900">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Loads table */}
      <div>
        <h2 className="mb-3 text-base font-bold text-gray-900">
          Loads ({loads.length})
        </h2>
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
            <tr className="border-b-2 border-gray-400 text-left text-xs text-gray-600">
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
            {loads.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-gray-500">
                  No loads in this period
                </td>
              </tr>
            )}
            {loads.map((l, i) => (
              <tr
                key={l.id}
                className={`border-b border-gray-200 ${i % 2 === 0 ? "" : "bg-gray-50"}`}
              >
                <td className="py-1.5 pr-3 font-mono text-xs">
                  {l.referenceNumber}
                </td>
                <td className="py-1.5 pr-3">
                  <div className="font-medium">
                    {l.pickupCity ?? l.pickupAddress.slice(0, 25)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {fmtDate(l.pickupDate)}
                  </div>
                </td>
                <td className="py-1.5 pr-3">
                  <div className="font-medium">
                    {l.deliveryCity ?? l.deliveryAddress.slice(0, 25)}
                  </div>
                  <div className="text-xs text-gray-500">
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
            {loads.length > 0 && (
              <tr className="border-t-2 border-gray-400 font-bold">
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
            )}
          </tbody>
        </table>
      </div>

      {/* Financial breakdown */}
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-3 text-base font-bold text-gray-900">
            Expenses &amp; Deductions
          </h2>
          <table className="w-full border-collapse">
            <tbody>
              <R
                label="Total revenue"
                value={fmt(data.revenue, data.currency)}
              />
              <tr>
                <td colSpan={2} className="py-1 border-b border-gray-300" />
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
          <h2 className="mb-3 text-base font-bold text-gray-900">
            Salary &amp; Tax Breakdown
          </h2>
          <table className="w-full border-collapse">
            <tbody>
              <R
                label="Distance driven"
                value={`${Math.round(data.totalKm).toLocaleString("en-US")} Mi`}
              />
              <R
                label="Rate EUR/Mi"
                value={
                  driver.salaryPerKm ? `${driver.salaryPerKm} EUR/Mi` : "-"
                }
              />
              <R label="Base salary" value={fmt(data.baseSalary)} />
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
                <td colSpan={2} className="py-1 border-b border-gray-300" />
              </tr>
              <R
                label="Employee pension (25%)"
                value={`- ${fmt(data.taxes.cas)}`}
                neg
              />
              <R
                label="Employee health ins. (10%)"
                value={`- ${fmt(data.taxes.cass)}`}
                neg
              />
              <R
                label="Income tax (10%)"
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
      <div className="border-t border-gray-300 pt-4 text-xs text-gray-500">
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
        /* Force light mode on screen AND print — overrides dark class on <html> */
        html, body {
          background-color: white !important;
          color: #111827 !important;
          color-scheme: light !important;
        }
        @media print {
          @page { margin: 1.5cm; size: A4; }
          html, body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white !important;
            color: #111827 !important;
            overflow: visible !important;
            height: auto !important;
          }
          body > * { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}
