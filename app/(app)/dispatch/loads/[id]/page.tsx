import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { LoadStatusBadge } from "@/components/loads/load-status-badge";
import { LoadStatusButton } from "@/components/loads/load-status-button";
import { LoadAssignDialog } from "@/components/loads/load-assign-dialog";
import { LOAD_STATUS_LABELS } from "@/lib/validators/load";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Pencil,
  MapPin,
  Package,
  User as UserIcon,
  Truck as TruckIcon,
  History,
  FileText,
} from "lucide-react";
import { DocumentSection } from "@/components/documents/document-section";

export const metadata = { title: "Load Details" };

export default async function LoadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requirePermission("loads:read");
  const { id } = await params;

  const load = await prisma.load.findFirst({
    where: { id, companyId: me.companyId ?? undefined },
    include: {
      customer: true,
      driver: { include: { user: { select: { name: true, phone: true } } } },
      truck: true,
      trailer: true,
      dispatcher: { select: { name: true } },
      createdBy: { select: { name: true } },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: { changedBy: { select: { name: true } } },
      },
      documents: { orderBy: { createdAt: "desc" } },
      invoice: { select: { id: true, number: true } },
    },
  });
  if (!load) notFound();

  const where = { companyId: me.companyId ?? undefined };
  const [drivers, trucks, trailers] = await Promise.all([
    prisma.driverProfile.findMany({
      where,
      include: { user: { select: { name: true } } },
    }),
    prisma.truck.findMany({
      where,
      orderBy: { plateNumber: "asc" },
      select: { id: true, plateNumber: true },
    }),
    prisma.trailer.findMany({
      where,
      orderBy: { plateNumber: "asc" },
      select: { id: true, plateNumber: true },
    }),
  ]);

  const canForce = me.role === "COMPANY_ADMIN" || me.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader
        title={load.referenceNumber}
        description={`Created ${formatDate(load.createdAt, true)} by ${load.createdBy?.name ?? "—"}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/dispatch/loads/${load.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
            {/* Issue invoice button — only shown when load is delivered and has no invoice */}
            {load.status === "DELIVERED" && !load.invoice && (
              <Button asChild variant="outline">
                <Link
                  href={`/accounting/invoices/new?loadId=${load.id}&customerId=${load.customerId ?? ""}&price=${load.price}&currency=${load.currency}`}
                >
                  <FileText className="mr-2 h-4 w-4" /> Issue Invoice
                </Link>
              </Button>
            )}
            {load.invoice && (
              <Button asChild variant="outline">
                <Link href={`/accounting/invoices/${load.invoice.id}`}>
                  <FileText className="mr-2 h-4 w-4" /> Invoice{" "}
                  {load.invoice.number}
                </Link>
              </Button>
            )}
            <LoadAssignDialog
              loadId={load.id}
              current={{
                driverId: load.driverId,
                truckId: load.truckId,
                trailerId: load.trailerId,
              }}
              drivers={drivers.map((d) => ({
                id: d.id,
                label: d.user.name ?? "Driver",
              }))}
              trucks={trucks.map((t) => ({ id: t.id, label: t.plateNumber }))}
              trailers={trailers.map((t) => ({
                id: t.id,
                label: t.plateNumber,
              }))}
              trigger={
                <Button variant="outline">
                  <UserIcon className="mr-2 h-4 w-4" /> Assign
                </Button>
              }
            />
            <LoadStatusButton
              loadId={load.id}
              current={load.status}
              canForce={canForce}
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
        <LoadStatusBadge status={load.status} className="text-sm" />
        <div className="text-2xl font-semibold tabular-nums">
          {formatCurrency(load.price, load.currency)}
        </div>
        {load.customer && (
          <div className="text-sm text-muted-foreground">
            Customer:{" "}
            <span className="font-medium text-foreground">
              {load.customer.name}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4 text-emerald-600" /> Pickup
          </h3>
          <div className="space-y-1 text-sm">
            <div className="font-medium">{load.pickupAddress}</div>
            <div className="text-muted-foreground">
              {[load.pickupCity, load.pickupCountry]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
            <div className="mt-2">{formatDate(load.pickupDate, true)}</div>
            {load.pickupNotes && (
              <div className="mt-2 text-muted-foreground">
                {load.pickupNotes}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4 text-rose-600" /> Delivery
          </h3>
          <div className="space-y-1 text-sm">
            <div className="font-medium">{load.deliveryAddress}</div>
            <div className="text-muted-foreground">
              {[load.deliveryCity, load.deliveryCountry]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
            <div className="mt-2">{formatDate(load.deliveryDate, true)}</div>
            {load.deliveryNotes && (
              <div className="mt-2 text-muted-foreground">
                {load.deliveryNotes}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Package className="h-4 w-4" /> Cargo
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Description</dt>
              <dd>{load.cargoDescription ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Weight</dt>
              <dd>{load.weightKg ? `${load.weightKg} kg` : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Volume</dt>
              <dd>{load.volumeM3 ? `${load.volumeM3} m³` : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Packages</dt>
              <dd>{load.packages ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Temperature</dt>
              <dd>{load.temperature ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">ADR</dt>
              <dd>{load.isHazardous ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Est. Distance</dt>
              <dd>
                {load.estimatedDistanceKm
                  ? `${load.estimatedDistanceKm} mi`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Actual Distance</dt>
              <dd>
                {load.actualDistanceKm ? `${load.actualDistanceKm} mi` : "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <TruckIcon className="h-4 w-4" /> Assigned Resources
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Driver</dt>
              <dd>
                {load.driver?.user.name ?? "—"}
                {load.driver?.user.phone && (
                  <div className="text-xs text-muted-foreground">
                    {load.driver.user.phone}
                  </div>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Truck</dt>
              <dd>{load.truck?.plateNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Trailer</dt>
              <dd>{load.trailer?.plateNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Dispatcher</dt>
              <dd>{load.dispatcher?.name ?? "—"}</dd>
            </div>
          </dl>
          {load.internalNotes && (
            <div className="mt-4 rounded-md bg-muted p-3 text-sm">
              <div className="text-xs font-medium text-muted-foreground">
                Internal Notes
              </div>
              <div className="mt-1 whitespace-pre-wrap">
                {load.internalNotes}
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <History className="h-4 w-4" /> Status History
        </h3>
        {load.statusHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded.</p>
        ) : (
          <ol className="space-y-3">
            {load.statusHistory.map((h) => (
              <li
                key={h.id}
                className="flex gap-3 border-l-2 border-primary/40 pl-4"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <LoadStatusBadge status={h.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(h.createdAt, true)} ·{" "}
                      {h.changedBy?.name ?? "System"}
                    </span>
                  </div>
                  {h.note && <p className="mt-1 text-sm">{h.note}</p>}
                  {h.lat != null && h.lng != null && (
                    <p className="text-xs text-muted-foreground">
                      📍 {h.lat.toFixed(5)}, {h.lng.toFixed(5)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 font-semibold">
          Documents ({load.documents.length})
        </h3>
        <DocumentSection
          initialDocuments={load.documents.map((d) => ({
            ...d,
            expiresAt: d.expiresAt ?? null,
            uploadedBy: null,
          }))}
          entityLink={{ loadId: load.id }}
          allowedTypes={["CMR", "BOL", "POD", "OTHER"]}
        />
      </section>

      <p className="text-xs text-muted-foreground">
        Status: {LOAD_STATUS_LABELS[load.status] ?? load.status}
      </p>
    </div>
  );
}
