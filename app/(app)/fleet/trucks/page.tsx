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
import {
  NewTrailerButton,
  TrailerRowActions,
} from "@/components/trailers/trailer-form-dialog";
import { formatDate, daysUntil } from "@/lib/utils";
import { Truck as TruckIcon, Container } from "lucide-react";

export const metadata = { title: "Trucks & Trailers" };

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_TRIP: "On Trip",
  IN_SERVICE: "In Service",
  UNAVAILABLE: "Unavailable",
};
const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  AVAILABLE: "default",
  ON_TRIP: "secondary",
  IN_SERVICE: "outline",
  UNAVAILABLE: "destructive",
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

  const truckWhere = {
    companyId: me.companyId ?? undefined,
    ...(status ? { status: status as never } : {}),
    ...buildSearch(q, ["plateNumber", "vin", "make", "model"]),
  };

  const trailerWhere = {
    companyId: me.companyId ?? undefined,
    ...(status ? { status: status as never } : {}),
    ...buildSearch(q, ["plateNumber", "type"]),
  };

  const [trucks, total, trailers] = await Promise.all([
    prisma.truck.findMany({
      where: truckWhere,
      orderBy: { fleetNumber: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.truck.count({ where: truckWhere }),
    prisma.trailer.findMany({
      where: trailerWhere,
      orderBy: { fleetNumber: "asc" },
    }),
  ]);

  const truckOpts = trucks.map((t) => ({
    id: t.id,
    label: `${t.fleetNumber != null ? `#${t.fleetNumber} · ` : ""}${t.plateNumber}`,
  }));
  const trailerOpts = trailers.map((tr) => ({
    id: tr.id,
    label: `${tr.fleetNumber != null ? `#${tr.fleetNumber} · ` : ""}${tr.plateNumber}`,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Trucks & Trailers"
        description="Company fleet."
        action={
          <div className="flex gap-2">
            <NewTrailerButton trucks={truckOpts} />
            <NewTruckButton trailers={trailerOpts} />
          </div>
        }
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

      {/* ── Trucks ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TruckIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Trucks</h2>
          <span className="text-sm text-muted-foreground">({total})</span>
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
                  <TableHead>#</TableHead>
                  <TableHead>Plate</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Year / mi</TableHead>
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
                      <TableCell className="text-muted-foreground font-mono text-sm w-12">
                        {t.fleetNumber != null ? `#${t.fleetNumber}` : "—"}
                      </TableCell>
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
                          ? `${t.mileage.toLocaleString("en-US")} mi`
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
                        <Badge
                          variant={STATUS_VARIANT[t.status] ?? "secondary"}
                        >
                          {STATUS_LABELS[t.status] ?? t.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TruckRowActions truck={t} trailers={trailerOpts} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <Pagination total={total} page={page} pageSize={pageSize} />
      </section>

      {/* ── Trailers ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Container className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Trailers</h2>
          <span className="text-sm text-muted-foreground">
            ({trailers.length})
          </span>
        </div>

        <div className="rounded-lg border bg-card">
          {trailers.length === 0 ? (
            <EmptyState
              icon={<Container className="h-10 w-10" />}
              title="No trailers found"
              description="Add your first trailer."
              action={<NewTrailerButton trucks={truckOpts} />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Plate</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>ITP / Insurance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trailers.map((tr) => {
                  const itpD = tr.itpExpiresAt
                    ? daysUntil(tr.itpExpiresAt)
                    : null;
                  const rcaD = tr.insuranceExpiresAt
                    ? daysUntil(tr.insuranceExpiresAt)
                    : null;
                  return (
                    <TableRow key={tr.id}>
                      <TableCell className="text-muted-foreground font-mono text-sm w-12">
                        {tr.fleetNumber != null ? `#${tr.fleetNumber}` : "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {tr.plateNumber}
                      </TableCell>
                      <TableCell>{tr.type ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {tr.capacityKg
                          ? `${tr.capacityKg.toLocaleString("en")} kg`
                          : "—"}
                        {tr.volumeM3 ? ` · ${tr.volumeM3} m³` : ""}
                      </TableCell>
                      <TableCell className="text-xs space-y-0.5">
                        <div>
                          ITP:{" "}
                          {tr.itpExpiresAt ? (
                            itpD! < 0 ? (
                              <Badge variant="destructive">
                                {formatDate(tr.itpExpiresAt)}
                              </Badge>
                            ) : itpD! <= 30 ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500 text-amber-600"
                              >
                                {formatDate(tr.itpExpiresAt)}
                              </Badge>
                            ) : (
                              formatDate(tr.itpExpiresAt)
                            )
                          ) : (
                            "—"
                          )}
                        </div>
                        <div>
                          RCA:{" "}
                          {tr.insuranceExpiresAt ? (
                            rcaD! < 0 ? (
                              <Badge variant="destructive">
                                {formatDate(tr.insuranceExpiresAt)}
                              </Badge>
                            ) : rcaD! <= 30 ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500 text-amber-600"
                              >
                                {formatDate(tr.insuranceExpiresAt)}
                              </Badge>
                            ) : (
                              formatDate(tr.insuranceExpiresAt)
                            )
                          ) : (
                            "—"
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {STATUS_LABELS[tr.status] ?? tr.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TrailerRowActions trailer={tr} trucks={truckOpts} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
