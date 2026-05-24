import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, FileText, Eye } from "lucide-react";
import type { InvoiceStatus } from "@prisma/client";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const me = await requirePermission("invoices:read");
  // SUPER_ADMIN without an assigned company sees all invoices in the system
  const companyFilter = me.companyId ? { companyId: me.companyId } : {};

  const sp = await searchParams;
  const status = sp.status ?? "";
  const search = sp.search ?? "";

  const invoices = await prisma.invoice.findMany({
    where: {
      ...companyFilter,
      status: status ? (status as InvoiceStatus) : undefined,
      OR: search
        ? [
            { number: { contains: search, mode: "insensitive" } },
            { customer: { name: { contains: search, mode: "insensitive" } } },
          ]
        : undefined,
    },
    include: {
      customer: { select: { id: true, name: true } },
    },
    orderBy: { issueDate: "desc" },
    take: 200,
  });

  // Totals — group by currency
  const byCurrency = new Map<string, { total: number; paid: number }>();
  for (const i of invoices) {
    const cur = i.currency ?? "USD";
    const entry = byCurrency.get(cur) ?? { total: 0, paid: 0 };
    entry.total += i.total;
    entry.paid += i.paidAmount;
    byCurrency.set(cur, entry);
  }
  // Pick the dominant currency (most invoices) for the KPI cards
  const dominantCurrency = invoices.length
    ? [...byCurrency.entries()].sort(
        (a, b) =>
          invoices.filter((i) => i.currency === b[0]).length -
          invoices.filter((i) => i.currency === a[0]).length,
      )[0][0]
    : me.companyId
      ? ((
          await prisma.company.findUnique({
            where: { id: me.companyId },
            select: { currency: true },
          })
        )?.currency ?? "USD")
      : "USD";

  const kpiTotal = byCurrency.get(dominantCurrency)?.total ?? 0;
  const kpiPaid = byCurrency.get(dominantCurrency)?.paid ?? 0;
  const kpiOutstanding = kpiTotal - kpiPaid;
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

  const canWrite = me.role !== "DRIVER";

  const STATUSES = [
    { value: "", label: "All" },
    { value: "DRAFT", label: "Draft" },
    { value: "SENT", label: "Sent" },
    { value: "PAID", label: "Paid" },
    { value: "OVERDUE", label: "Overdue" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Manage invoices issued to customers."
        action={
          canWrite && (
            <Link href="/accounting/invoices/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Invoice
              </Button>
            </Link>
          )
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Invoiced</p>
            <p className="text-2xl font-bold">
              {formatCurrency(kpiTotal, dominantCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Collected</p>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(kpiPaid, dominantCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(kpiOutstanding, dominantCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-2xl font-bold text-rose-600">{overdueCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/accounting/invoices?status=${s.value}${search ? `&search=${search}` : ""}`}
          >
            <Button
              variant={status === s.value ? "default" : "outline"}
              size="sm"
            >
              {s.label}
            </Button>
          </Link>
        ))}
      </div>

      {/* Table */}
      {invoices.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No invoices found"
          description={
            status
              ? "No invoices match the selected status."
              : "Create your first invoice to get started."
          }
          action={
            canWrite && (
              <Link href="/accounting/invoices/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Invoice
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead />
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
                    <TableCell>{inv.customer?.name ?? "—"}</TableCell>
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
                        <span className="text-emerald-600">✓</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/accounting/invoices/${inv.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
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
