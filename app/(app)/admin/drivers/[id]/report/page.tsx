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
    <tr className={bold ? "border-t-2 border-black font-bold" : ""}>
      <td className="py-1 pr-4 text-sm text-gray-600 print:text-gray-700">
        {label}
      </td>
      <td
        className={`py-1 text-right font-mono text-sm ${neg ? "text-red-600" : bold ? "text-black" : "text-gray-900"}`}
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
    driver.salaryPerKm,
    driver.commissionRate,
    period,
  );
  const { loads, fmt, fmtDate } = data;

  const fullName = `${driver.firstName} ${driver.lastName}`;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-8 print:px-0 print:py-0">
      {/* Toolbar — hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/admin/drivers/${id}?period=${period}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Înapoi la profil
        </Link>
        <PrintButton />
      </div>

      {/* Header */}
      <div className="border-b-2 border-black pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground print:text-black">
              {fullName}
            </h1>
            <p className="text-sm text-muted-foreground print:text-gray-600">
              {driver.user.email}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-foreground print:text-black">
              Raport Financiar
            </div>
            <div className="text-sm text-muted-foreground print:text-gray-600">
              {data.periodLabel}
            </div>
            <div className="text-xs text-muted-foreground print:text-gray-500">
              Generat:{" "}
              {new Date().toLocaleDateString("ro-RO", {
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
          { label: "Loads livrate", value: String(loads.length) },
          { label: "Venit brut", value: fmt(data.revenue, data.currency) },
          {
            label: "Km parcurși",
            value: `${Math.round(data.totalKm).toLocaleString("ro-RO")} km`,
          },
          { label: "Salariu net", value: fmt(data.taxes.net) },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded border border-gray-300 p-3 print:border-gray-400"
          >
            <div className="text-xs text-gray-500 print:text-gray-600">
              {k.label}
            </div>
            <div className="text-lg font-bold text-foreground print:text-black">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Loads table */}
      <div>
        <h2 className="mb-3 text-base font-bold text-foreground print:text-black">
          Curse Efectuate ({loads.length})
        </h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-400 text-left text-xs text-gray-600 print:text-gray-700">
              <th className="pb-2 pr-3">Nr. Ref.</th>
              <th className="pb-2 pr-3">Pickup</th>
              <th className="pb-2 pr-3">Livrare</th>
              <th className="pb-2 pr-3">Client</th>
              <th className="pb-2 pr-3">Camion</th>
              <th className="pb-2 pr-3 text-right">Km</th>
              <th className="pb-2 text-right">Preț</th>
            </tr>
          </thead>
          <tbody>
            {loads.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-gray-500">
                  Fără curse în această perioadă
                </td>
              </tr>
            )}
            {loads.map((l, i) => (
              <tr
                key={l.id}
                className={`border-b border-gray-200 ${i % 2 === 0 ? "" : "bg-gray-50 print:bg-gray-100"}`}
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
                  {l.customer?.name ?? "—"}
                </td>
                <td className="py-1.5 pr-3 font-mono text-xs">
                  {l.truck?.plateNumber ?? "—"}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {Math.round(
                    l.actualDistanceKm ?? l.estimatedDistanceKm ?? 0,
                  ).toLocaleString("ro-RO")}
                </td>
                <td className="py-1.5 text-right tabular-nums font-semibold">
                  {fmt(l.price, l.currency)}
                </td>
              </tr>
            ))}
            {loads.length > 0 && (
              <tr className="border-t-2 border-gray-400 font-bold">
                <td colSpan={5} className="py-2 text-sm">
                  TOTAL
                </td>
                <td className="py-2 text-right tabular-nums">
                  {Math.round(data.totalKm).toLocaleString("ro-RO")}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {fmt(data.revenue, data.currency)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Financial breakdown */}
      <div className="grid grid-cols-2 gap-8">
        {/* Deductions */}
        <div>
          <h2 className="mb-3 text-base font-bold text-foreground print:text-black">
            Cheltuieli & Deduceri
          </h2>
          <table className="w-full border-collapse">
            <tbody>
              <R
                label="Venituri totale"
                value={fmt(data.revenue, data.currency)}
              />
              <tr>
                <td colSpan={2} className="py-1 border-b border-gray-300" />
              </tr>
              {data.fuelCost > 0 && (
                <R
                  label={`Combustibil (${data.fuelCount} înreg.)`}
                  value={`- ${fmt(data.fuelCost, data.currency)}`}
                  neg
                />
              )}
              {data.tollCost > 0 && (
                <R
                  label="Taxe drum / Pod"
                  value={`- ${fmt(data.tollCost, data.currency)}`}
                  neg
                />
              )}
              {data.parkingCost > 0 && (
                <R
                  label="Parcare"
                  value={`- ${fmt(data.parkingCost, data.currency)}`}
                  neg
                />
              )}
              {data.repairCost > 0 && (
                <R
                  label="Reparații"
                  value={`- ${fmt(data.repairCost, data.currency)}`}
                  neg
                />
              )}
              {data.maintCost > 0 && (
                <R
                  label="Mentenanță"
                  value={`- ${fmt(data.maintCost, data.currency)}`}
                  neg
                />
              )}
              {data.permitsCost > 0 && (
                <R
                  label="Permits speciale"
                  value={`- ${fmt(data.permitsCost, data.currency)}`}
                  neg
                />
              )}
              {data.otherCost > 0 && (
                <R
                  label="Alte cheltuieli"
                  value={`- ${fmt(data.otherCost, data.currency)}`}
                  neg
                />
              )}
              {data.totalDeductions === 0 && (
                <R label="Fără cheltuieli" value="—" />
              )}
              <R
                label="Total deduceri"
                value={`- ${fmt(data.totalDeductions, data.currency)}`}
                neg
                bold
              />
              <tr>
                <td colSpan={2} className="py-1" />
              </tr>
              <R
                label="Contribuție netă"
                value={fmt(data.netContribution, data.currency)}
                bold
              />
            </tbody>
          </table>
        </div>

        {/* Salary & taxes */}
        <div>
          <h2 className="mb-3 text-base font-bold text-foreground print:text-black">
            Calcul Salariu & Taxe
          </h2>
          <table className="w-full border-collapse">
            <tbody>
              <R
                label={`Distanță parcursă`}
                value={`${Math.round(data.totalKm).toLocaleString("ro-RO")} km`}
              />
              <R
                label="Rată €/km"
                value={driver.salaryPerKm ? `${driver.salaryPerKm} €/km` : "—"}
              />
              <R label="Salariu bază" value={fmt(data.baseSalary)} />
              {driver.commissionRate && driver.commissionRate > 0 && (
                <R
                  label={`Comision (${driver.commissionRate}%)`}
                  value={fmt(data.commission)}
                />
              )}
              <R label="Salariu BRUT" value={fmt(data.brutSalary)} bold />
              <tr>
                <td colSpan={2} className="py-1 border-b border-gray-300" />
              </tr>
              <R
                label="CAS angajat (25%)"
                value={`- ${fmt(data.taxes.cas)}`}
                neg
              />
              <R
                label="CASS angajat (10%)"
                value={`- ${fmt(data.taxes.cass)}`}
                neg
              />
              <R
                label="Impozit venit (10%)"
                value={`- ${fmt(data.taxes.impozit)}`}
                neg
              />
              <R
                label="Total taxe"
                value={`- ${fmt(data.taxes.total)}`}
                neg
                bold
              />
              <tr>
                <td colSpan={2} className="py-1" />
              </tr>
              <R
                label="SALARIU NET DE PLATĂ"
                value={fmt(data.taxes.net)}
                bold
              />
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-300 pt-4 text-xs text-gray-500 print:text-gray-600">
        <p>
          Raport generat automat de TMS · {fullName} · {data.periodLabel}
        </p>
        <p className="mt-1">
          Taxe calculate conform legislației române: CAS 25% + CASS 10% +
          Impozit venit 10% din (Brut − CAS − CASS).
        </p>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
