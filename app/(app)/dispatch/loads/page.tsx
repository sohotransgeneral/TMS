import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { parseListParams, buildSearch } from "@/lib/action-helpers";
import { PageHeader } from "@/components/dashboard/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LoadStatusBadge,
  LoadRefLink,
} from "@/components/loads/load-status-badge";
import { LOAD_STATUS_LABELS } from "@/lib/validators/load";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, PackageOpen } from "lucide-react";

export const metadata = { title: "Loads" };

type SP = Record<string, string | string[] | undefined>;

export default async function LoadsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const me = await requirePermission("loads:read");
  const sp = await searchParams;
  const { page, pageSize, q, skip } = parseListParams(sp);
  const status = typeof sp.status === "string" ? sp.status : undefined;

  const where = {
    companyId: me.companyId ?? undefined,
    ...(status ? { status: status as never } : {}),
    ...buildSearch(q, [
      "referenceNumber",
      "pickupCity",
      "deliveryCity",
      "pickupAddress",
      "deliveryAddress",
    ]),
  };

  const [loads, total] = await Promise.all([
    prisma.load.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        customer: { select: { name: true } },
        driver: { include: { user: { select: { name: true } } } },
        truck: { select: { plateNumber: true } },
      },
    }),
    prisma.load.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loads"
        description="All company loads."
        action={
          <Button asChild>
            <Link href="/dispatch/loads/new">
              <Plus className="mr-2 h-4 w-4" /> New Load
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search by reference, city, address…" />
        <FilterSelect
          paramKey="status"
          allLabel="All statuses"
          options={Object.entries(LOAD_STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <div className="ml-auto flex gap-2 text-sm">
          <Link
            href="/dispatch/cockpit"
            className="text-primary hover:underline"
          >
            View Kanban →
          </Link>
          <Link href="/dispatch/map" className="text-primary hover:underline">
            Live Map →
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {loads.length === 0 ? (
          <EmptyState
            icon={<PackageOpen className="h-10 w-10" />}
            title="Nu există curse"
            description="Creează prima cursă pentru a o aloca unui șofer."
            action={
              <Button asChild>
                <Link href="/dispatch/loads/new">
                  <Plus className="mr-2 h-4 w-4" /> Cursă nouă
                </Link>
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referință</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Traseu</TableHead>
                <TableHead>Încărcare</TableHead>
                <TableHead>Șofer / Camion</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Preț</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <LoadRefLink
                      id={l.id}
                      referenceNumber={l.referenceNumber}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.customer?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.pickupCity ?? l.pickupAddress} →{" "}
                    {l.deliveryCity ?? l.deliveryAddress}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(l.pickupDate, true)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.driver?.user.name ?? "—"}
                    {l.truck && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {l.truck.plateNumber}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <LoadStatusBadge status={l.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(l.price, l.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination total={total} page={page} pageSize={pageSize} />
    </div>
  );
}
