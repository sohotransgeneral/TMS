import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDate, daysUntil } from "@/lib/utils";
import { DocumentSection } from "@/components/documents/document-section";
import { PermitList } from "@/components/fleet/permit-list";
import { NewPermitButton } from "@/components/fleet/permit-form-dialog";

export const metadata = { title: "Truck Details" };

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_ROUTE: "On Route",
  MAINTENANCE: "In Service",
  INACTIVE: "Inactive",
};
const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  AVAILABLE: "default",
  ON_ROUTE: "secondary",
  MAINTENANCE: "outline",
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

export default async function TruckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requirePermission("trucks:read");
  const { id } = await params;

  const truck = await prisma.truck.findFirst({
    where: { id, companyId: me.companyId ?? undefined },
  });
  if (!truck) notFound();

  const [documents, permits] = await Promise.all([
    prisma.document.findMany({
      where: { truckId: id },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.truckPermit.findMany({
      where: { truckId: id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={truck.plateNumber}
        description={[truck.make, truck.model, truck.year]
          .filter(Boolean)
          .join(" · ")}
        action={
          <Badge variant={STATUS_VARIANT[truck.status] ?? "secondary"}>
            {STATUS_LABELS[truck.status] ?? truck.status}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Info */}
        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-3 font-semibold">Vehicle Information</h3>
          <dl className="divide-y divide-border text-sm">
            {[
              ["VIN", truck.vin],
              ["Combustibil", truck.fuelType],
              [
                "Consum mediu",
                truck.avgConsumption
                  ? `${truck.avgConsumption} L/100 km`
                  : null,
              ],
              [
                "Kilometraj",
                truck.mileage != null
                  ? `${truck.mileage.toLocaleString("en")} km`
                  : null,
              ],
              ["Culoare", truck.color],
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

        {/* Expiry dates */}
        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-3 font-semibold">Document Expiry Dates</h3>
          <div className="divide-y divide-border">
            <ExpiryRow label="Insurance" date={truck.insuranceExpiresAt} />
            <ExpiryRow label="ITP" date={truck.itpExpiresAt} />
            <ExpiryRow label="Vignette" date={truck.vignetteExpiresAt} />
            <ExpiryRow label="Tachograph" date={truck.tachographExpiresAt} />
          </div>
          {!truck.insuranceExpiresAt &&
            !truck.itpExpiresAt &&
            !truck.vignetteExpiresAt &&
            !truck.tachographExpiresAt && (
              <p className="text-sm text-muted-foreground">
                No expiry dates recorded
              </p>
            )}
        </section>
      </div>

      {truck.notes && (
        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-2 font-semibold">Notes</h3>
          <p className="text-sm">{truck.notes}</p>
        </section>
      )}

      {/* Permits */}
      <section className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Special Permits ({permits.length})</h3>
          <NewPermitButton truckId={truck.id} />
        </div>
        <PermitList permits={permits} truckId={truck.id} canEdit />
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
          entityLink={{ truckId: truck.id }}
          allowedTypes={[
            "ITP",
            "INSURANCE",
            "VIGNETTE",
            "TACHOGRAPH",
            "CONTRACT",
            "OTHER",
          ]}
        />
      </section>
    </div>
  );
}
