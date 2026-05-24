import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { parseListParams } from "@/lib/action-helpers";
import { PageHeader } from "@/components/dashboard/page-header";
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
  MaintenanceFormDialog,
  DeleteMaintenanceButton,
} from "@/components/maintenance/maintenance-dialog";
import {
  MAINTENANCE_STATUSES,
  MAINTENANCE_STATUS_LABELS,
} from "@/lib/validators/maintenance";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import { Wrench } from "lucide-react";
import { hasPermission } from "@/lib/permissions";

export const metadata = { title: "Maintenance" };

type SP = Record<string, string | string[] | undefined>;

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  SCHEDULED: "secondary",
  IN_PROGRESS: "outline",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const me = await requirePermission("maintenance:read");
  const sp = await searchParams;
  const { page, pageSize, skip } = parseListParams(sp);
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const canWrite = hasPermission(me.role, "maintenance:write");

  const where = {
    companyId: me.companyId ?? undefined,
    ...(status ? { status: status as never } : {}),
  };

  const [records, total, trucks, trailers] = await Promise.all([
    prisma.maintenance.findMany({
      where,
      orderBy: { scheduledAt: "desc" },
      skip,
      take: pageSize,
      include: {
        truck: { select: { plateNumber: true } },
        trailer: { select: { plateNumber: true } },
      },
    }),
    prisma.maintenance.count({ where }),
    me.companyId
      ? prisma.truck.findMany({
          where: { companyId: me.companyId },
          select: { id: true, plateNumber: true, make: true, model: true },
          orderBy: { plateNumber: "asc" },
        })
      : prisma.truck.findMany({
          select: { id: true, plateNumber: true, make: true, model: true },
          orderBy: { plateNumber: "asc" },
        }),
    me.companyId
      ? prisma.trailer.findMany({
          where: { companyId: me.companyId },
          select: { id: true, plateNumber: true, type: true },
          orderBy: { plateNumber: "asc" },
        })
      : prisma.trailer.findMany({
          select: { id: true, plateNumber: true, type: true },
          orderBy: { plateNumber: "asc" },
        }),
  ]);

  const opts = {
    trucks: trucks.map((t) => ({
      id: t.id,
      label: `${t.plateNumber}${t.make ? ` — ${t.make} ${t.model ?? ""}`.trimEnd() : ""}`,
    })),
    trailers: trailers.map((t) => ({
      id: t.id,
      label: `${t.plateNumber}${t.type ? ` (${t.type})` : ""}`,
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description={`${total} scheduled or completed work orders.`}
        action={canWrite ? <MaintenanceFormDialog {...opts} /> : null}
      />
      <div className="flex flex-wrap gap-3">
        <FilterSelect
          paramKey="status"
          allLabel="All statuses"
          options={MAINTENANCE_STATUSES.map((s) => ({
            value: s,
            label: MAINTENANCE_STATUS_LABELS[s],
          }))}
        />
      </div>

      <div className="rounded-lg border bg-card">
        {records.length === 0 ? (
          <EmptyState
            icon={<Wrench className="h-10 w-10" />}
            title="No maintenance records"
            description="Schedule your first maintenance entry."
            action={canWrite ? <MaintenanceFormDialog {...opts} /> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Work</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((m) => {
                const days =
                  m.status === "SCHEDULED" ? daysUntil(m.scheduledAt) : null;
                const overdue = days !== null && days < 0;
                const soon = days !== null && days >= 0 && days <= 7;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.truck?.plateNumber ?? m.trailer?.plateNumber ?? "—"}
                      <div className="text-xs text-muted-foreground">
                        {m.truck ? "Truck" : m.trailer ? "Trailer" : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{m.title}</div>
                      {m.partsReplaced.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {m.partsReplaced.join(", ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDate(m.scheduledAt)}</div>
                      {overdue && (
                        <Badge variant="destructive" className="mt-1">
                          overdue -{-days!}d
                        </Badge>
                      )}
                      {soon && (
                        <Badge
                          variant="outline"
                          className="mt-1 border-amber-500 text-amber-600"
                        >
                          in {days}d
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.completedAt ? formatDate(m.completedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.cost != null
                        ? formatCurrency(m.cost, m.currency)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[m.status] ?? "secondary"}>
                        {MAINTENANCE_STATUS_LABELS[
                          m.status as keyof typeof MAINTENANCE_STATUS_LABELS
                        ] ?? m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canWrite && <DeleteMaintenanceButton id={m.id} />}
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
