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
        pickupCity: true,
        deliveryCity: true,
        price: true,
        accessorialAmount: true,
        loadInvoiceNumber: true,
      },
      take: 100,
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { vatRate: true, invoicePrefix: true },
    }),
  ]);

  // Pre-fill invoice line from load (city names + price)
  const loadFromUrl = loadIdFromUrl
    ? loads.find((l) => l.id === loadIdFromUrl)
    : null;
  const priceFromUrl = sp.price
    ? Number(sp.price)
    : loadFromUrl
      ? loadFromUrl.price + (loadFromUrl.accessorialAmount ?? 0)
      : null;
  const descFromUrl = loadFromUrl
    ? [loadFromUrl.pickupCity, loadFromUrl.deliveryCity]
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
          pickupCity: l.pickupCity,
          deliveryCity: l.deliveryCity,
          price: l.price,
          accessorialAmount: l.accessorialAmount,
          loadInvoiceNumber: l.loadInvoiceNumber,
        }))}
        defaultVatRate={company?.vatRate ?? 19}
        defaultCurrency={sp.currency ?? "USD"}
        defaultLoadId={loadIdFromUrl}
        defaultCustomerId={sp.customerId ?? null}
        defaultItems={defaultItems}
      />
    </div>
  );
}
