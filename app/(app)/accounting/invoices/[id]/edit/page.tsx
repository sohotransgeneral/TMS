import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { InvoiceForm } from "@/components/accounting/invoice-form";

export const metadata = { title: "Edit invoice" };

type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
};

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requirePermission("invoices:write");
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, ...(me.companyId ? { companyId: me.companyId } : {}) },
  });
  if (!invoice) notFound();

  const companyId = me.companyId ?? invoice.companyId;

  const [customers, loads, company] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.load.findMany({
      where: {
        companyId,
        OR: [{ invoice: null }, { id: invoice.loadId ?? "__none__" }],
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

  const items = (invoice.items as InvoiceItem[] | null) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Editare ${invoice.number}`}
        description="Modify invoice data."
      />
      <InvoiceForm
        initial={{
          id: invoice.id,
          series: invoice.series,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          customerId: invoice.customerId,
          loadId: invoice.loadId,
          currency: invoice.currency,
          vatRate: invoice.vatRate,
          notes: invoice.notes,
          items,
        }}
        customers={customers.map((c) => ({
          id: c.id,
          label: c.name,
        }))}
        loads={loads.map((l) => ({
          id: l.id,
          label: `${l.referenceNumber} · ${l.status}`,
        }))}
        defaultVatRate={company?.vatRate ?? 19}
        defaultCurrency={invoice.currency}
      />
    </div>
  );
}
