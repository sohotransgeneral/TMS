import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/accounting/invoice-status-badge";
import { RecordPaymentDialog } from "@/components/accounting/record-payment-dialog";
import {
  InvoiceStatusDialog,
  DeleteInvoiceButton,
} from "@/components/accounting/invoice-actions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Building2, Download, Pencil } from "lucide-react";

export const metadata = { title: "Invoice" };

type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requirePermission("invoices:read");
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, ...(me.companyId ? { companyId: me.companyId } : {}) },
    include: {
      company: { select: { name: true, logoUrl: true } },
      customer: true,
      load: { select: { id: true, referenceNumber: true, loadInvoiceNumber: true } },
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!invoice) notFound();

  const items = (invoice.items as InvoiceItem[] | null) ?? [];
  const remaining = invoice.total - invoice.paidAmount;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Invoice ${invoice.number}`}
        description={`Issued on ${formatDate(invoice.issueDate)} · Due ${formatDate(invoice.dueDate)}`}
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </a>
            <Link href={`/accounting/invoices/${invoice.id}/edit`}>
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            <InvoiceStatusDialog
              invoiceId={invoice.id}
              current={invoice.status}
              trigger={<Button variant="outline">Status</Button>}
            />
            {remaining > 0.005 && (
              <RecordPaymentDialog
                invoiceId={invoice.id}
                remaining={remaining}
                currency={invoice.currency}
                trigger={<Button>Record Payment</Button>}
              />
            )}
            <DeleteInvoiceButton invoiceId={invoice.id} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Invoice Details</CardTitle>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            {/* Company branding */}
            <div className="flex items-center gap-3 pt-2">
              <div className="h-10 w-10 rounded-md border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {invoice.company?.logoUrl ? (
                  <Image
                    src={invoice.company.logoUrl}
                    alt={invoice.company.name}
                    width={40}
                    height={40}
                    className="object-contain h-full w-full"
                    unoptimized
                  />
                ) : (
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <span className="font-semibold text-sm">
                {invoice.company?.name}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Customer</div>
                <div className="font-medium">
                  {invoice.customer?.name ?? "—"}
                </div>
                {invoice.customer?.taxId && (
                  <div className="text-xs text-muted-foreground">
                    CIF {invoice.customer.taxId}
                  </div>
                )}
              </div>
              <div>
                <div className="text-muted-foreground">Associated Load</div>
                <div>
                  {invoice.load ? (
                    <Link
                      href={`/dispatch/loads/${invoice.load.id}`}
                      className="font-medium hover:underline"
                    >
                      {invoice.load.referenceNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
              {invoice.series && (
                <div>
                  <div className="text-muted-foreground">Invoice #</div>
                  <div className="font-medium">{invoice.series}</div>
                </div>
              )}
              {(invoice.load as { loadInvoiceNumber?: string | null } | null)?.loadInvoiceNumber && (
                <div>
                  <div className="text-muted-foreground">Load Invoice #</div>
                  <div className="font-medium">{(invoice.load as { loadInvoiceNumber?: string | null }).loadInvoiceNumber}</div>
                </div>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell>{it.description}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(
                        it.total ?? it.quantity * it.unitPrice,
                        invoice.currency,
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="text-center text-muted-foreground"
                    >
                      No line items
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Total</span>
                <span>{formatCurrency(invoice.total, invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Paid</span>
                <span>
                  {formatCurrency(invoice.paidAmount, invoice.currency)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Remaining</span>
                <span>{formatCurrency(remaining, invoice.currency)}</span>
              </div>
            </div>

            {invoice.notes && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Note
                </div>
                <div className="whitespace-pre-wrap">{invoice.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments ({invoice.payments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payments recorded.
              </p>
            ) : (
              <ul className="space-y-3">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="rounded-md border p-3 text-sm">
                    <div className="flex justify-between font-medium">
                      <span>{formatCurrency(p.amount, p.currency)}</span>
                      <span className="text-muted-foreground">
                        {formatDate(p.paidAt)}
                      </span>
                    </div>
                    {p.method && (
                      <div className="text-xs text-muted-foreground">
                        Method: {p.method}
                      </div>
                    )}
                    {p.reference && (
                      <div className="text-xs text-muted-foreground">
                        Ref: {p.reference}
                      </div>
                    )}
                    {p.notes && <div className="text-xs">{p.notes}</div>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
