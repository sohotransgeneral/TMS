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
  NewTruckButton,
  TruckRowActions,
} from "@/components/trucks/truck-form-dialog";
import { formatDate, daysUntil } from "@/lib/utils";
import { Truck as TruckIcon } from "lucide-react";

export const metadata = { title: "Trucks" };

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_ROUTE: "On Route",
  MAINTENANCE: "In Service",
  INACTIVE: "Inactive",
};
const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  AVAILABLE: "default",
  ON_ROUTE: "secondary",
  MAINTENANCE: "outline",
  INACTIVE: "destructive",
};

function nextExpiry(truck: {
  itpExpiresAt: Date | null;
  insuranceExpiresAt: Date | null;
  vignetteExpiresAt: Date | null;
  tachographExpiresAt: Date | null;
}) {
  const dates = [
    truck.itpExpiresAt,
    truck.insuranceExpiresAt,
    truck.vignetteExpiresAt,
    truck.tachographExpiresAt,
  ].filter(Boolean) as Date[];
  if (dates.length === 0) return null;
  return dates.sort((a, b) => a.getTime() - b.getTime())[0];
}

type SP = Record<string, string | string[] | undefined>;

export default async function TrucksPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const me = await requirePermission("trucks:read");
  const sp = await searchParams;
  const { page, pageSize, q, skip } = parseListParams(sp);
  const status = typeof sp.status === "string" ? sp.status : undefined;

  const where = {
    companyId: me.companyId ?? undefined,
    ...(status ? { status: status as never } : {}),
    ...buildSearch(q, ["plateNumber", "vin", "make", "model"]),
  };

  const [trucks, total] = await Promise.all([
    prisma.truck.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.truck.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trucks"
        description="Company fleet."
        action={<NewTruckButton />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search by plate, VIN, make…" />
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
        {trucks.length === 0 ? (
          <EmptyState
            icon={<TruckIcon className="h-10 w-10" />}
            title="No trucks found"
            description="Add your first truck to assign it to loads."
            action={<NewTruckButton />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plate</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Year / km</TableHead>
                <TableHead>Next Expiry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trucks.map((t) => {
                const next = nextExpiry(t);
                const days = next ? daysUntil(next) : null;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/fleet/trucks/${t.id}`}
                        className="hover:underline text-primary"
                      >
                        {t.plateNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        {[t.make, t.model].filter(Boolean).join(" ") || "—"}
                      </div>
                      {t.vin && (
                        <div className="text-xs text-muted-foreground">
                          VIN {t.vin}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.year ?? "—"} ·{" "}
                      {t.mileage != null
                        ? `${t.mileage.toLocaleString("ro-RO")} km`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {next ? (
                        days! < 0 ? (
                          <Badge variant="destructive">
                            {formatDate(next)} (expired)
                          </Badge>
                        ) : days! <= 30 ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-600"
                          >
                            {formatDate(next)} ({days}d)
                          </Badge>
                        ) : (
                          <span className="text-sm">{formatDate(next)}</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[t.status] ?? "secondary"}>
                        {STATUS_LABELS[t.status] ?? t.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <TruckRowActions truck={t} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination total={total} page={page} pageSize={pageSize} />
    </div>
  );
}
