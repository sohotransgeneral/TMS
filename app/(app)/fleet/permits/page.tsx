import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ShieldCheck,
  FileText,
  Receipt,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { PERMIT_TYPES } from "@/lib/permit-types";

export const metadata = { title: "Truck Permits" };

function statusBadge(validTo: Date | null) {
  if (!validTo) return <Badge variant="secondary">No expiry</Badge>;
  const diff = (validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return <Badge variant="destructive">Expired</Badge>;
  if (diff < 14)
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-600">
        <AlertTriangle className="mr-1 h-3 w-3" />
        {Math.ceil(diff)}d left
      </Badge>
    );
  return <Badge className="bg-green-600 text-white">Active</Badge>;
}

function typeLabel(type: string) {
  return PERMIT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export default async function PermitsPage() {
  const me = await requirePermission("trucks:read");

  const permits = await prisma.truckPermit.findMany({
    where: { companyId: me.companyId ?? undefined },
    orderBy: { validTo: "asc" },
    include: {
      truck: { select: { plateNumber: true, make: true, model: true } },
    },
  });

  const expiringSoon = permits.filter((p) => {
    if (!p.validTo) return false;
    const diff = (p.validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff < 14;
  });
  const expired = permits.filter((p) => p.validTo && p.validTo < new Date());
  const totalCost = permits.reduce((s, p) => s + (p.cost ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Special Permits"
        description="Oversize, overweight and other special permits for your trucks."
      />

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Permits</p>
          <p className="mt-1 text-2xl font-bold">{permits.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Expiring (14 days)</p>
          <p
            className={`mt-1 text-2xl font-bold ${expiringSoon.length > 0 ? "text-amber-600" : ""}`}
          >
            {expiringSoon.length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Cost</p>
          <p className="mt-1 text-2xl font-bold">
            {formatCurrency(totalCost, "USD")}
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {permits.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-10 w-10" />}
            title="No permits yet"
            description="Add permits from the truck detail page."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Truck</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Permit #</TableHead>
                <TableHead>Jurisdiction</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Valid To</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Docs</TableHead>
                <TableHead>Charged To</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permits.map((p) => (
                <TableRow
                  key={p.id}
                  className={
                    p.validTo && p.validTo < new Date()
                      ? "bg-red-50/40 dark:bg-red-950/10"
                      : ""
                  }
                >
                  <TableCell>
                    <Link
                      href={`/fleet/trucks/${p.truckId}`}
                      className="font-medium hover:underline"
                    >
                      {p.truck.plateNumber}
                    </Link>
                    {p.truck.make && (
                      <div className="text-xs text-muted-foreground">
                        {p.truck.make} {p.truck.model}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{typeLabel(p.type)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.permitNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.jurisdiction ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[180px] text-xs text-muted-foreground truncate">
                    {p.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.validTo ? formatDate(p.validTo) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {p.cost != null ? formatCurrency(p.cost, p.currency) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {p.permitImageUrl && (
                        <a
                          href={p.permitImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Permit document"
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <FileText className="h-4 w-4" />
                        </a>
                      )}
                      {p.invoiceUrl && (
                        <a
                          href={p.invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Invoice / Receipt"
                          className="text-green-500 hover:text-green-700"
                        >
                          <Receipt className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(p as unknown as { chargedTo: string }).chargedTo ===
                    "DRIVER" ? (
                      <Badge
                        variant="secondary"
                        className="text-blue-600 border-blue-300"
                      >
                        👤 Driver
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        🏢 Company
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{statusBadge(p.validTo)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
