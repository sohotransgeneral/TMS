import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDate, daysUntil } from "@/lib/utils";
import { DocumentSection } from "@/components/documents/document-section";

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
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requirePermission("drivers:read");
  const { id } = await params;

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
