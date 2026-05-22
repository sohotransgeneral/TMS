import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { parseListParams, buildSearch } from "@/lib/action-helpers";
import { PageHeader } from "@/components/dashboard/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  NewDriverButton,
  DriverRowActions,
} from "@/components/drivers/driver-form-dialog";
import { formatDate, daysUntil } from "@/lib/utils";
import { IdCard } from "lucide-react";

export const metadata = { title: "Drivers" };

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_ROUTE: "On Route",
  REST: "Resting",
  ON_LEAVE: "On Leave",
  INACTIVE: "Inactive",
};
const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  AVAILABLE: "default",
  ON_ROUTE: "secondary",
  REST: "outline",
  ON_LEAVE: "outline",
  INACTIVE: "destructive",
};

function expiryBadge(date: Date | string | null) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const days = daysUntil(date);
  if (days === null || days < 0)
    return <Badge variant="destructive">{formatDate(date)} (expired)</Badge>;
  if (days !== null && days <= 30)
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600">
        {formatDate(date)} ({days}d)
      </Badge>
    );
  return <span className="text-sm">{formatDate(date)}</span>;
}

type SP = Record<string, string | string[] | undefined>;

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const me = await requirePermission("drivers:read");
  const sp = await searchParams;
  const { page, pageSize, q, skip } = parseListParams(sp);
  const status = typeof sp.status === "string" ? sp.status : undefined;

  const where = {
    companyId: me.companyId ?? undefined,
    ...(status ? { status: status as never } : {}),
    ...buildSearch(q, ["firstName", "lastName", "licenseNumber", "cnp"]),
  };

  const [drivers, total] = await Promise.all([
    prisma.driverProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: { user: { select: { id: true, email: true, phone: true } } },
    }),
    prisma.driverProfile.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers"
        description="Your team and document validity."
        action={<NewDriverButton />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search by name, CNP, license…" />
        <FilterSelect
          paramKey="status"
          allLabel="All statuses"
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </div>

      <div className="rounded-lg border bg-card">
        {drivers.length === 0 ? (
          <EmptyState
            icon={<IdCard className="h-10 w-10" />}
            title="No drivers found"
            description="Add your first driver to assign loads."
            action={<NewDriverButton />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Tachograph</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="font-medium">
                      <Link
                        href={`/admin/drivers/${d.id}`}
                        className="hover:underline text-primary"
                      >
                        {d.firstName} {d.lastName}
                      </Link>
                    </div>
                    {d.cnp && (
                      <div className="text-xs text-muted-foreground">
                        CNP {d.cnp}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{d.user.email}</div>
                    {d.user.phone && (
                      <div className="text-muted-foreground">
                        {d.user.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{d.licenseNumber ?? "—"}</div>
                    {d.licenseExpiresAt && (
                      <div className="text-xs">
                        {expiryBadge(d.licenseExpiresAt)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{d.tachoCardNumber ?? "—"}</div>
                    {d.tachoCardExpiresAt && (
                      <div className="text-xs">
                        {expiryBadge(d.tachoCardExpiresAt)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[d.status] ?? "secondary"}>
                      {STATUS_LABELS[d.status] ?? d.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DriverRowActions
                      driver={{
                        ...d,
                        licenseCategories: d.licenseCategories ?? [],
                      }}
                    />
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
