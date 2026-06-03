import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { InvoiceForm } from "@/components/accounting/invoice-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const me = await requirePermission("invoices:write");
  const sp = await searchParams;

  // SUPER_ADMIN without a company - take the first company in the system
  const companyId =
    me.companyId ??
    (await prisma.company.findFirst({ select: { id: true } }))?.id;

  // No company in the system yet
  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="New invoice"
          description="Issue an invoice for a customer."
        />
        <div className="rounded-lg border bg-card p-8 text-center space-y-3">
          <p className="text-muted-foreground">
            No company is registered in the system. Please register a company
            first.
          </p>
          <Link href="/register">
            <Button>Register company</Button>
          </Link>
        </div>
      </div>
    );
  }

  // If coming from a load, include that load even if it already has an invoice
  const loadIdFromUrl = sp.loadId ?? null;
  const [customers, loads, company] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.load.findMany({
      where: {
        companyId,
        OR: [
          { invoice: null },
          ...(loadIdFromUrl ? [{ id: loadIdFromUrl }] : []),
        ],
      },
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        pickupAddress: true,
        pickupCity: true,
        pickupState: true,
        pickupZip: true,
        deliveryAddress: true,
        deliveryCity: true,
        deliveryState: true,
        deliveryZip: true,
        price: true,
        accessorialAmount: true,
        loadInvoiceNumber: true,
        brokerName: true,
        customerId: true,
      },
      take: 100,
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { vatRate: true, invoicePrefix: true, invoiceCounter: true },
    }),
  ]);

  // Pre-fill invoice line from load (full address + price)
  function fmtAddr(
    address?: string | null,
    city?: string | null,
    state?: string | null,
    zip?: string | null,
  ) {
    return [address, city, [state, zip].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
  }
  const loadFromUrl = loadIdFromUrl
    ? loads.find((l) => l.id === loadIdFromUrl)
    : null;
  const priceFromUrl = sp.price
    ? Number(sp.price)
    : loadFromUrl
      ? loadFromUrl.price + (loadFromUrl.accessorialAmount ?? 0)
      : null;
  const descFromUrl = loadFromUrl
    ? [
        fmtAddr(
          loadFromUrl.pickupAddress,
          loadFromUrl.pickupCity,
          loadFromUrl.pickupState,
          loadFromUrl.pickupZip,
        ),
        fmtAddr(
          loadFromUrl.deliveryAddress,
          loadFromUrl.deliveryCity,
          loadFromUrl.deliveryState,
          loadFromUrl.deliveryZip,
        ),
      ]
        .filter(Boolean)
        .join(" > ") || "Freight transport"
    : "Freight transport";
  const defaultItems =
    priceFromUrl && priceFromUrl > 0
      ? [{ description: descFromUrl, quantity: 1, unitPrice: priceFromUrl }]
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="New invoice"
        description="Issue an invoice for a customer."
      />
      <InvoiceForm
        customers={customers.map((c) => ({ id: c.id, label: c.name }))}
        loads={loads.map((l) => ({
          id: l.id,
          label: `${l.referenceNumber} · ${l.status}`,
        }))}
        loadsData={loads.map((l) => ({
          id: l.id,
          pickupAddress: l.pickupAddress,
          pickupCity: l.pickupCity,
          pickupState: l.pickupState,
          pickupZip: l.pickupZip,
          deliveryAddress: l.deliveryAddress,
          deliveryCity: l.deliveryCity,
          deliveryState: l.deliveryState,
          deliveryZip: l.deliveryZip,
          price: l.price,
          accessorialAmount: l.accessorialAmount,
          loadInvoiceNumber: l.loadInvoiceNumber,
        }))}
        defaultVatRate={company?.vatRate ?? 19}
        defaultCurrency={sp.currency ?? "USD"}
        defaultLoadId={loadIdFromUrl}
        defaultCustomerId={sp.customerId ?? loadFromUrl?.customerId ?? null}
        defaultCustomerName={loadFromUrl?.brokerName ?? null}
        defaultItems={defaultItems}
        defaultSeries={(() => {
          const prefix = company?.invoicePrefix || "INV";
          const next = (company?.invoiceCounter ?? 0) + 1;
          return `${prefix}-${new Date().getFullYear()}-${String(next).padStart(5, "0")}`;
        })()}
      />
    </div>
  );
}
