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
import { ShieldCheck, FileText } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { loadTotal } from "@/lib/accessorials";
import {
  parsePermits,
  permitTypeLabel,
  loadNetOfPermits,
} from "@/lib/load-permits";
import { getSignedDownloadUrl } from "@/lib/r2";

export const metadata = { title: "Permits" };

function place(city: string | null, state: string | null, address: string) {
  return [city, state].filter(Boolean).join(", ") || address;
}

export default async function PermitsPage() {
  const me = await requirePermission("loads:read");

  const loads = await prisma.load.findMany({
    where: { companyId: me.companyId ?? undefined, permits: { not: null } },
    orderBy: { pickupDate: "desc" },
    select: {
      id: true,
      referenceNumber: true,
      pickupDate: true,
      pickupCity: true,
      pickupState: true,
      pickupAddress: true,
      deliveryCity: true,
      deliveryState: true,
      deliveryAddress: true,
      price: true,
      accessorialAmount: true,
      permits: true,
      permitAmount: true,
      currency: true,
      driver: { select: { firstName: true, lastName: true } },
      truck: { select: { plateNumber: true } },
    },
  });

  // Permit documents live in private storage, so each link needs signing.
  const rows = await Promise.all(
    loads.map(async (l) => {
      const permits = parsePermits(l.permits);
      const links = await Promise.all(
        permits.map(async (p) => {
          if (!p.docUrl) return null;
          if (/^(https?:)?\/\//.test(p.docUrl) || p.docUrl.startsWith("/")) {
            return p.docUrl;
          }
          try {
            return await getSignedDownloadUrl(p.docUrl, 3600);
          } catch {
            return null;
          }
        }),
      );
      return { load: l, permits, links };
    }),
  ).then((all) => all.filter((r) => r.permits.length > 0));

  const currency = rows[0]?.load.currency ?? "USD";
  const permitCount = rows.reduce((s, r) => s + r.permits.length, 0);
  const totalSpent = rows.reduce((s, r) => s + (r.load.permitAmount ?? 0), 0);
  const totalRevenue = rows.reduce((s, r) => s + loadTotal(r.load), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permits"
        description="Every load that needed special permits, and what was spent on them. Permits are added on the load itself."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Loads with permits</p>
          <p className="mt-1 text-2xl font-bold">{rows.length}</p>
          <p className="text-xs text-muted-foreground">
            {permitCount} permit{permitCount === 1 ? "" : "s"} in total
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Spent on permits</p>
          <p className="mt-1 text-2xl font-bold">
            {formatCurrency(totalSpent, currency)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Those loads, after permits
          </p>
          <p className="mt-1 text-2xl font-bold">
            {formatCurrency(totalRevenue - totalSpent, currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            of {formatCurrency(totalRevenue, currency)} before permits
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {rows.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-10 w-10" />}
            title="No permits yet"
            description="Add permits while creating or editing a load."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Load</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Driver / Truck</TableHead>
                <TableHead>Permits</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Permits cost</TableHead>
                <TableHead className="text-right">After permits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ load: l, permits, links }) => {
                const total = loadTotal(l);
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link
                        href={`/dispatch/loads/${l.id}`}
                        className="font-medium hover:underline"
                      >
                        {l.referenceNumber}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(l.pickupDate)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {place(l.pickupCity, l.pickupState, l.pickupAddress)}
                      <span className="text-muted-foreground"> → </span>
                      {place(l.deliveryCity, l.deliveryState, l.deliveryAddress)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.driver
                        ? `${l.driver.firstName} ${l.driver.lastName}`
                        : "—"}
                      {l.truck && (
                        <div className="text-xs text-muted-foreground">
                          {l.truck.plateNumber}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <ul className="space-y-1">
                        {permits.map((p, i) => (
                          <li
                            key={i}
                            className="flex flex-wrap items-center gap-x-2 text-sm"
                          >
                            <Badge variant="secondary">
                              {permitTypeLabel(p.type)}
                            </Badge>
                            {p.jurisdiction && <span>{p.jurisdiction}</span>}
                            {p.permitNumber && (
                              <span className="font-mono text-xs text-muted-foreground">
                                #{p.permitNumber}
                              </span>
                            )}
                            <span className="tabular-nums text-muted-foreground">
                              {formatCurrency(p.cost, l.currency)}
                            </span>
                            {links[i] && (
                              <a
                                href={links[i]!}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={p.docName ?? "Permit document"}
                                className="text-blue-500 hover:text-blue-700"
                              >
                                <FileText className="h-4 w-4" />
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(total, l.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-red-600">
                      − {formatCurrency(l.permitAmount ?? 0, l.currency)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(loadNetOfPermits(total, l), l.currency)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
