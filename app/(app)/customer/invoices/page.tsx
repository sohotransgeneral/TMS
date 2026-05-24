import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/accounting/invoice-status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileText } from "lucide-react";

export const metadata = { title: "My Invoices" };

export default async function CustomerInvoicesPage() {
  const me = await requirePermission("invoices:read");

  // Find the Customer record linked to this user's email
  const customer = me.companyId
    ? await prisma.customer.findFirst({
        where: {
          companyId: me.companyId,
          email: me.email ?? undefined,
        },
      })
    : null;

  const invoices = customer
    ? await prisma.invoice.findMany({
        where: { customerId: customer.id },
        orderBy: { issueDate: "desc" },
        take: 100,
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Invoices"
        description="Invoices issued to your account."
      />

      {invoices.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No invoices yet"
          description="Invoices issued to you will appear here."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const remaining = inv.total - inv.paidAmount;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono font-medium">
                      {inv.number}
                    </TableCell>
                    <TableCell>{formatDate(inv.issueDate)}</TableCell>
                    <TableCell>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(inv.total, inv.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {remaining > 0.005 ? (
                        <span className="font-medium text-amber-600">
                          {formatCurrency(remaining, inv.currency)}
                        </span>
                      ) : (
                        <span className="text-emerald-600">✓ Paid</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
