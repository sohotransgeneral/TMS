import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { InvoiceForm } from "@/components/accounting/invoice-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Factură nouă" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const me = await requirePermission("invoices:write");
  const sp = await searchParams;

  // SUPER_ADMIN fără companie — ia prima companie din sistem
  const companyId =
    me.companyId ??
    (await prisma.company.findFirst({ select: { id: true } }))?.id;

  // Nicio companie în sistem încă
  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Factură nouă"
          description="Emite o factură pentru un client."
        />
        <div className="rounded-lg border bg-card p-8 text-center space-y-3">
          <p className="text-muted-foreground">
            Nu există nicio companie înregistrată în sistem. Înregistrează mai
            întâi o companie.
          </p>
          <Link href="/register">
            <Button>Înregistrează companie</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Dacă venim dintr-un load, includem și acel load chiar dacă are deja factură
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
      select: { id: true, referenceNumber: true, status: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { vatRate: true, invoicePrefix: true },
    }),
  ]);

  // Pre-completare linie factură din prețul cursei
  const priceFromUrl = sp.price ? Number(sp.price) : null;
  const defaultItems =
    priceFromUrl && priceFromUrl > 0
      ? [
          {
            description: "Transport marfă",
            quantity: 1,
            unitPrice: priceFromUrl,
          },
        ]
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factură nouă"
        description="Emite o factură pentru un client."
      />
      <InvoiceForm
        customers={customers.map((c) => ({ id: c.id, label: c.name }))}
        loads={loads.map((l) => ({
          id: l.id,
          label: `${l.referenceNumber} · ${l.status}`,
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
