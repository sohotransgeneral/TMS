import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, daysUntil } from "@/lib/utils";
import { DocumentSection } from "@/components/documents/document-section";
import { DriverFinancialReport, getPeriodRange } from "@/components/drivers/driver-financial-report";
import { PeriodSelector } from "@/components/drivers/period-selector";
import { FileDown, ExternalLink } from "lucide-react";

export const metadata = { title: "Driver Details" };

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_ROUTE: "On Route",
  REST: "Resting",
  ON_LEAVE: "On Leave",
  INACTIVE: "Inactive",
};
const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  AVAILABLE: "default",
  ON_ROUTE: "secondary",
  REST: "outline",
  ON_LEAVE: "outline",
  INACTIVE: "destructive",
};

function ExpiryRow({ label, date }: { label: string; date: Date | null }) {
  if (!date) return null;
  const days = daysUntil(date);
  const color =
    days === null
      ? ""
      : days < 0
        ? "text-red-600"
        : days < 30
          ? "text-amber-600"
          : "text-green-600";
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color}`}>
        {formatDate(date)}{" "}
        {days !== null && (
          <span className="text-xs">
            ({days < 0 ? `expired ${Math.abs(days)}d` : `${days}d`})
          </span>
        )}
      </span>
    </div>
  );
}

export default async function DriverDetailPage({
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
    include: {
      user: { select: { name: true, email: true, phone: true } },
    },
  });
  if (!driver) notFound();

  const documents = await prisma.document.findMany({
    where: { driverProfileId: id },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const { from, to } = getPeriodRange(period);
  const periodLoads = await prisma.load.findMany({
    where: {
      driverId: driver.id,
      pickupDate: { gte: from, lte: to },
    },
    orderBy: { pickupDate: "desc" },
    select: {
      id: true,
      referenceNumber: true,
      pickupCity: true,
      deliveryCity: true,
      pickupDate: true,
      price: true,
      currency: true,
      status: true,
      actualDistanceKm: true,
      estimatedDistanceKm: true,
      customer: { select: { name: true } },
    },
  });

  const fullName = `${driver.firstName} ${driver.lastName}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName}
        description={driver.user.email ?? undefined}
        action={
          <Badge variant={STATUS_VARIANT[driver.status] ?? "secondary"}>
            {STATUS_LABELS[driver.status] ?? driver.status}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal info */}
        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-3 font-semibold">Personal Information</h3>
          <dl className="divide-y divide-border text-sm">
            {[
              ["Phone", driver.user.phone],
              ["CNP", driver.cnp],
              [
                "Date of Birth",
                driver.dateOfBirth ? formatDate(driver.dateOfBirth) : null,
              ],
              [
                "Employed Since",
                driver.employedSince ? formatDate(driver.employedSince) : null,
              ],
              [
                "Salary / km",
                driver.salaryPerKm ? `${driver.salaryPerKm} €` : null,
              ],
              [
                "Commission",
                driver.commissionRate ? `${driver.commissionRate}%` : null,
              ],
              ["Rating", driver.rating ? `${driver.rating}/5` : null],
            ].map(([k, v]) =>
              v ? (
                <div key={k as string} className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ) : null,
            )}
          </dl>
        </section>

        {/* License & tachograph */}
        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-3 font-semibold">Permis & Tahograf</h3>
          <dl className="divide-y divide-border text-sm">
            {[
              ["License No.", driver.licenseNumber],
              ["Categories", driver.licenseCategories?.join(", ") || null],
              [
                "Issued On",
                driver.licenseIssuedAt
                  ? formatDate(driver.licenseIssuedAt)
                  : null,
              ],
              ["Tachograph Card", driver.tachoCardNumber],
            ].map(([k, v]) =>
              v ? (
                <div key={k as string} className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ) : null,
            )}
          </dl>
          <div className="mt-2 divide-y divide-border">
            <ExpiryRow label="License Exp." date={driver.licenseExpiresAt} />
            <ExpiryRow
              label="Tachograph Card Exp."
              date={driver.tachoCardExpiresAt}
            />
          </div>
        </section>
      </div>

      {driver.internalNotes && (
        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-2 font-semibold">Internal Notes</h3>
          <p className="text-sm">{driver.internalNotes}</p>
        </section>
      )}

      {/* Financial Report */}
      <section className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Raport Financiar</h3>
          <div className="flex items-center gap-2">
            <PeriodSelector />
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/drivers/${driver.id}/report?period=${period}`} target="_blank">
                <FileDown className="mr-2 h-4 w-4" />
                PDF
              </Link>
            </Button>
          </div>
        </div>
        <Suspense
          fallback={
            <div className="py-8 text-center text-sm text-muted-foreground">
              Se calculează...
            </div>
          }
        >
          <DriverFinancialReport
            driverId={driver.id}
            salaryPerKm={driver.salaryPerKm}
            commissionRate={driver.commissionRate}
            period={period}
          />
        </Suspense>
      </section>

      {/* Loads in period */}
      <section className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 font-semibold">Curse în perioadă ({periodLoads.length})</h3>
        {periodLoads.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Fără curse în această perioadă.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Referință</th>
                  <th className="pb-2 pr-4">Pickup → Livrare</th>
                  <th className="pb-2 pr-4">Client</th>
                  <th className="pb-2 pr-4">Data</th>
                  <th className="pb-2 pr-4 text-right">Km</th>
                  <th className="pb-2 pr-4 text-right">Preț</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {periodLoads.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/40">
                    <td className="py-2 pr-4">
                      <Link href={`/dispatch/loads/${l.id}`} className="flex items-center gap-1 font-mono text-xs text-primary hover:underline">
                        {l.referenceNumber}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="font-medium">{l.pickupCity ?? "—"}</span>
                      <span className="mx-1 text-muted-foreground">→</span>
                      <span className="font-medium">{l.deliveryCity ?? "—"}</span>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{l.customer?.name ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground tabular-nums">
                      {new Date(l.pickupDate).toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {Math.round(l.actualDistanceKm ?? l.estimatedDistanceKm ?? 0).toLocaleString("ro-RO")}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums font-semibold">
                      {new Intl.NumberFormat("ro-RO", { style: "currency", currency: l.currency }).format(l.price)}
                    </td>
                    <td className="py-2">
                      <Badge variant="outline" className="text-xs">{l.status.replace(/_/g, " ")}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Documents */}
      <section className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 font-semibold">Documents ({documents.length})</h3>
        <DocumentSection
          initialDocuments={documents.map((d) => ({
            ...d,
            expiresAt: d.expiresAt ?? null,
            uploadedBy: d.uploadedBy ?? null,
          }))}
          entityLink={{ driverProfileId: driver.id }}
          allowedTypes={[
            "DRIVER_LICENSE",
            "ID_CARD",
            "CONTRACT",
            "TACHOGRAPH",
            "OTHER",
          ]}
        />
      </section>
    </div>
  );
}
