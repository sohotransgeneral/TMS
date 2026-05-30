import { redirect } from "next/navigation";

export default function TrailersPage() {
  redirect("/fleet/trucks");
}

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
  NewTrailerButton,
  TrailerRowActions,
} from "@/components/trailers/trailer-form-dialog";
import { formatDate, daysUntil } from "@/lib/utils";
import { Container } from "lucide-react";

export const metadata = { title: "Trailers" };

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_TRIP: "On Trip",
  IN_SERVICE: "In Service",
  UNAVAILABLE: "Unavailable",
};

type SP = Record<string, string | string[] | undefined>;

export default async function TrailersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const me = await requirePermission("trailers:read");
  const sp = await searchParams;
  const { page, pageSize, q, skip } = parseListParams(sp);
  const status = typeof sp.status === "string" ? sp.status : undefined;

  const where = {
    companyId: me.companyId ?? undefined,
    ...(status ? { status: status as never } : {}),
    ...buildSearch(q, ["plateNumber", "type"]),
  };

  const [trailers, total] = await Promise.all([
    prisma.trailer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.trailer.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trailers"
        description="Semi-trailers and transport equipment."
        action={<NewTrailerButton />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search by plate, type…" />
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
        {trailers.length === 0 ? (
          <EmptyState
            icon={<Container className="h-10 w-10" />}
            title="No trailers found"
            description="Add your first trailer."
            action={<NewTrailerButton />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
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
                      <TrailerRowActions trailer={tr} />
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
