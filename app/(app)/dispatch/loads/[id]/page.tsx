import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { LoadStatusBadge } from "@/components/loads/load-status-badge";
import { LoadStatusButton } from "@/components/loads/load-status-button";
import { LoadAssignDialog } from "@/components/loads/load-assign-dialog";
import { CreateInvoiceButton } from "@/components/loads/create-invoice-button";
import { createInvoiceFromLoad } from "@/actions/invoices";
import { LOAD_STATUS_LABELS } from "@/lib/validators/load";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Pencil,
  MapPin,
  User as UserIcon,
  Truck as TruckIcon,
  History,
  FileText,
  Building2,
  Phone,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { DocumentSection } from "@/components/documents/document-section";

export const metadata = { title: "Load Details" };

function Row({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? "—"}</span>
    </div>
  );
}

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
      select: {
        id: true,
        plateNumber: true,
        fleetNumber: true,
        pairedTrailerId: true,
      },
    }),
    prisma.trailer.findMany({
      where,
      orderBy: { plateNumber: "asc" },
      select: {
        id: true,
        plateNumber: true,
        fleetNumber: true,
        pairedTruckId: true,
      },
    }),
  ]);

  const canForce = me.role === "COMPANY_ADMIN" || me.role === "SUPER_ADMIN";

  const l = load as typeof load & {
    loadNumber?: string | null;
    pickupNumber?: string | null;
    deliveryNumber?: string | null;
    commodity?: string | null;
    enteredBy?: string | null;
    invoicingCompany?: string | null;
    billingMethod?: string | null;
    billingType?: string | null;
    loadInvoiceNumber?: string | null;
    accessorialAmount?: number | null;
    pickupTimezone?: string | null;
    deliveryTimezone?: string | null;
    dispatchNotes?: string | null;
  };

  const totalRate = (l.price ?? 0) + (l.accessorialAmount ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={load.referenceNumber}
        description={`Updated ${formatDate(load.updatedAt, true)} by ${load.createdBy?.name ?? "—"}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/dispatch/loads/${load.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
            {!load.invoice && (
              <CreateInvoiceButton
                action={createInvoiceFromLoad.bind(null, load.id)}
              />
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

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
        <LoadStatusBadge status={load.status} className="text-sm" />
        <div className="text-2xl font-semibold tabular-nums">
          {formatCurrency(totalRate, load.currency)}
        </div>
        {load.customer && (
          <div className="text-sm text-muted-foreground">
            Bill-to:{" "}
            <span className="font-medium text-foreground">
              {load.customer.name}
            </span>
          </div>
        )}
        {load.equipment && (
          <div className="ml-auto rounded bg-muted px-2 py-0.5 text-sm font-medium">
            {load.equipment}
          </div>
        )}
      </div>

      {/* 3-column grid */}
      <div className="grid gap-6 xl:grid-cols-3 lg:grid-cols-2">
        {/* Col 1 – Load & Equipment */}
        <section className="grid content-start gap-4 rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Load and Equipment</h3>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Load #" value={l.loadNumber} />
            <Row label="Pickup #" value={l.pickupNumber} />
            <Row label="Delivery #" value={l.deliveryNumber} />
            <Row label="Commodity" value={l.commodity} />
            <Row
              label="Weight"
              value={
                load.weightKg ? `${load.weightKg.toLocaleString()} lbs` : null
              }
            />
            <Row label="Equipment Type" value={load.equipment} />
          </div>
          {load.isHazardous && (
            <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" /> Hazardous / ADR
            </div>
          )}
        </section>

        {/* Col 2 – Groups & Billing */}
        <section className="grid content-start gap-4 rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Groups and Billing</h3>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Entered By" value={l.enteredBy} />
            <Row label="Invoicing Company" value={l.invoicingCompany} />
            <Row label="Bill-to Customer" value={load.customer?.name ?? load.brokerName} />
            <Row label="Billing Method" value={l.billingMethod} />
            <Row label="Billing Type" value={l.billingType} />
            <Row label="Invoice #" value={l.loadInvoiceNumber} />
          </div>
          <div className="border-t pt-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <UserIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Driver:</span>
              <span className="font-medium">
                {load.driver?.user?.name ?? "—"}
              </span>
              {load.driver?.user?.phone && (
                <span className="text-muted-foreground text-xs">
                  · {load.driver.user.phone}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <TruckIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Truck:</span>
                <span className="font-medium">
                  {load.truck?.plateNumber ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Trailer:</span>
                <span className="font-medium">
                  {load.trailer?.plateNumber ?? "—"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Col 3 – Financials */}
        <section className="grid content-start gap-4 rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Financials</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rate</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(load.price, load.currency)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Accessorial</span>
              <span className="font-medium tabular-nums">
                {l.accessorialAmount
                  ? formatCurrency(l.accessorialAmount, load.currency)
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold text-sm">
              <span>Total</span>
              <span className="tabular-nums">
                {formatCurrency(totalRate, load.currency)}
              </span>
            </div>
          </div>
          {(load.poNumber || load.soNumber) && (
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <Row label="PO #" value={load.poNumber} />
              <Row label="SO #" value={load.soNumber} />
            </div>
          )}
          {(load.brokerName || load.brokerPhone) && (
            <div className="border-t pt-3 space-y-1.5 text-sm">
              <span className="text-xs text-muted-foreground">Broker</span>
              {load.brokerName && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{load.brokerName}</span>
                </div>
              )}
              {load.brokerPhone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <a
                    href={`tel:${load.brokerPhone}`}
                    className="hover:underline"
                  >
                    {load.brokerPhone}
                  </a>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Shipper + Receiver */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4 text-emerald-600" /> Shipper
          </h3>
          <div className="space-y-2 text-sm">
            {load.pickupCompanyName && (
              <div className="flex items-center gap-2 font-semibold text-base">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                {load.pickupCompanyName}
              </div>
            )}
            <div className="font-medium">{load.pickupAddress || "—"}</div>
            <div className="text-muted-foreground">
              {[
                load.pickupCity,
                load.pickupState,
                load.pickupZip,
                load.pickupCountry,
              ]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
            <div className="mt-1 font-medium">
              {formatDate(load.pickupDate, true)}
              {l.pickupTimezone && (
                <span className="ml-1 text-xs text-muted-foreground">
                  {l.pickupTimezone}
                </span>
              )}
            </div>
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
            <MapPin className="h-4 w-4 text-rose-600" /> Receiver
          </h3>
          <div className="space-y-2 text-sm">
            {load.deliveryCompanyName && (
              <div className="flex items-center gap-2 font-semibold text-base">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                {load.deliveryCompanyName}
              </div>
            )}
            <div className="font-medium">{load.deliveryAddress || "—"}</div>
            <div className="text-muted-foreground">
              {[
                load.deliveryCity,
                load.deliveryState,
                load.deliveryZip,
                load.deliveryCountry,
              ]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
            <div className="mt-1 font-medium">
              {formatDate(load.deliveryDate, true)}
              {l.deliveryTimezone && (
                <span className="ml-1 text-xs text-muted-foreground">
                  {l.deliveryTimezone}
                </span>
              )}
            </div>
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
      </div>

      {/* Notes */}
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

      {(l.dispatchNotes || load.internalNotes) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {l.dispatchNotes && (
            <section className="rounded-lg border bg-card p-6">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <MessageSquare className="h-4 w-4" /> Dispatch Notes
              </h3>
              <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                {l.dispatchNotes}
              </div>
            </section>
          )}
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
        </div>
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
