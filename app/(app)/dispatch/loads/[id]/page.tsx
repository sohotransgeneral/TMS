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
  Building2,
  Phone,
  Mail,
  Hash,
  AlertTriangle,
  DollarSign,
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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        truckId: true,
        trailerId: true,
        user: { select: { name: true } },
      },
    }),
    prisma.truck.findMany({
      where,
      orderBy: { plateNumber: "asc" },
      select: { id: true, plateNumber: true, fleetNumber: true, pairedTrailerId: true },
    }),
    prisma.trailer.findMany({
      where,
      orderBy: { plateNumber: "asc" },
      select: { id: true, plateNumber: true, fleetNumber: true, pairedTruckId: true },
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
                label: d.user?.name ?? "Driver",
              }))}
              trucks={trucks.map((t) => ({
                id: t.id,
                label: `${t.fleetNumber != null ? `#${t.fleetNumber} · ` : ""}${t.plateNumber}`,
                pairedTrailerId: t.pairedTrailerId ?? null,
              }))}
              trailers={trailers.map((t) => ({
                id: t.id,
                label: `${t.fleetNumber != null ? `#${t.fleetNumber} · ` : ""}${t.plateNumber}`,
                pairedTruckId: t.pairedTruckId ?? null,
              }))}
              driverAssignments={drivers.map((d) => ({
                id: d.id,
                truckId: d.truckId,
                trailerId: d.trailerId,
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

      {/* Summary bar */}
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
        {(load.loadType || load.equipment) && (
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            {load.loadType && (
              <span className="rounded bg-muted px-2 py-0.5 font-medium text-foreground">
                {load.loadType}
              </span>
            )}
            {load.equipment && <span>{load.equipment}</span>}
          </div>
        )}
      </div>

      {/* Pickup + Delivery */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4 text-emerald-600" /> Pickup
          </h3>
          <div className="space-y-2 text-sm">
            {load.pickupCompanyName && (
              <div className="flex items-center gap-2 font-semibold text-base">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                {load.pickupCompanyName}
              </div>
            )}
            <div className="font-medium">{load.pickupAddress}</div>
            <div className="text-muted-foreground">
              {[load.pickupCity, load.pickupCountry]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
            <div className="mt-1 font-medium">
              {formatDate(load.pickupDate, true)}
            </div>
            {(load as { pickupWindow?: string | null }).pickupWindow && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                🕐 {(load as { pickupWindow?: string | null }).pickupWindow}
              </div>
            )}
            {(load.pickupContact || load.pickupPhone) && (
              <div className="mt-2 space-y-1 border-t pt-2">
                {load.pickupContact && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <UserIcon className="h-3.5 w-3.5" /> {load.pickupContact}
                  </div>
                )}
                {load.pickupPhone && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <a
                      href={`tel:${load.pickupPhone}`}
                      className="hover:underline"
                    >
                      {load.pickupPhone}
                    </a>
                  </div>
                )}
              </div>
            )}
            {load.pickupNotes && (
              <div className="mt-2 rounded bg-muted px-2 py-1 text-muted-foreground">
                {load.pickupNotes}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4 text-rose-600" /> Delivery
          </h3>
          <div className="space-y-2 text-sm">
            {load.deliveryCompanyName && (
              <div className="flex items-center gap-2 font-semibold text-base">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                {load.deliveryCompanyName}
              </div>
            )}
            <div className="font-medium">{load.deliveryAddress}</div>
            <div className="text-muted-foreground">
              {[load.deliveryCity, load.deliveryCountry]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
            <div className="mt-1 font-medium">
              {formatDate(load.deliveryDate, true)}
            </div>
            {(load as { deliveryWindow?: string | null }).deliveryWindow && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                🕐 {(load as { deliveryWindow?: string | null }).deliveryWindow}
              </div>
            )}
            {(load.deliveryContact || load.deliveryPhone) && (
              <div className="mt-2 space-y-1 border-t pt-2">
                {load.deliveryContact && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <UserIcon className="h-3.5 w-3.5" /> {load.deliveryContact}
                  </div>
                )}
                {load.deliveryPhone && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <a
                      href={`tel:${load.deliveryPhone}`}
                      className="hover:underline"
                    >
                      {load.deliveryPhone}
                    </a>
                  </div>
                )}
              </div>
            )}
            {load.deliveryNotes && (
              <div className="mt-2 rounded bg-muted px-2 py-1 text-muted-foreground">
                {load.deliveryNotes}
              </div>
            )}
          </div>
        </section>

        {/* Cargo */}
        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Package className="h-4 w-4" /> Cargo
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2">
              <dt className="text-muted-foreground">Description</dt>
              <dd>{load.cargoDescription ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Weight</dt>
              <dd>
                {load.weightKg ? `${load.weightKg.toLocaleString()} lbs` : "—"}
              </dd>
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
              <dt className="text-muted-foreground">ADR / Hazmat</dt>
              <dd>{load.isHazardous ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Miles</dt>
              <dd>
                {load.estimatedDistanceKm
                  ? `${load.estimatedDistanceKm.toLocaleString()} mi`
                  : "—"}
              </dd>
            </div>
            {load.actualDistanceKm && (
              <div>
                <dt className="text-muted-foreground">Actual Miles</dt>
                <dd>{load.actualDistanceKm.toLocaleString()} mi</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Pay breakdown + References */}
        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <DollarSign className="h-4 w-4" /> Pay & References
          </h3>
          <div className="space-y-4 text-sm">
            {/* Pay breakdown */}
            <div className="rounded-md bg-muted p-3 space-y-1.5">
              {load.lineHaulRate != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Line Haul</span>
                  <span className="tabular-nums font-medium">
                    {formatCurrency(load.lineHaulRate, load.currency)}
                  </span>
                </div>
              )}
              {load.fuelSurcharge != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fuel Surcharge</span>
                  <span className="tabular-nums font-medium">
                    {formatCurrency(load.fuelSurcharge, load.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5 font-semibold">
                <span>Total Pay</span>
                <span className="tabular-nums">
                  {formatCurrency(load.price, load.currency)}
                </span>
              </div>
            </div>

            {/* References */}
            {(load.poNumber || load.soNumber) && (
              <div className="flex flex-wrap gap-4">
                {load.poNumber && (
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">PO:</span>
                    <span className="font-medium">{load.poNumber}</span>
                  </div>
                )}
                {load.soNumber && (
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">SO:</span>
                    <span className="font-medium">{load.soNumber}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Assigned Resources */}
      <section className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <TruckIcon className="h-4 w-4" /> Assigned Resources
        </h3>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Driver</dt>
            <dd>
              {load.driver?.user?.name ?? "—"}
              {load.driver?.user?.phone && (
                <div className="text-xs text-muted-foreground">
                  {load.driver.user.phone}
                </div>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Truck</dt>
            <dd>
              {load.truck?.plateNumber ?? "—"}
              {load.truck?.make && (
                <div className="text-xs text-muted-foreground">
                  {[load.truck.make, load.truck.model]
                    .filter(Boolean)
                    .join(" ")}
                </div>
              )}
            </dd>
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
      </section>

      {/* Broker */}
      {(load.brokerName || load.brokerPhone || load.brokerEmail) && (
        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Building2 className="h-4 w-4" /> Broker Contact
          </h3>
          <div className="flex flex-wrap gap-6 text-sm">
            {load.brokerName && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{load.brokerName}</span>
              </div>
            )}
            {load.brokerPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${load.brokerPhone}`} className="hover:underline">
                  {load.brokerPhone}
                </a>
              </div>
            )}
            {load.brokerEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`mailto:${load.brokerEmail}`}
                  className="hover:underline"
                >
                  {load.brokerEmail}
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Special Instructions */}
      {load.specialInstructions && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" /> Special Instructions
          </h3>
          <div className="whitespace-pre-wrap text-sm text-amber-900 dark:text-amber-200">
            {load.specialInstructions}
          </div>
        </section>
      )}

      {/* Internal Notes */}
      {load.internalNotes && (
        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <FileText className="h-4 w-4" /> Internal Notes
          </h3>
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">
            {load.internalNotes}
          </div>
        </section>
      )}

      {/* Status History */}
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
