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
  ExpenseFormDialog,
  ExpenseDecisionButtons,
  DeleteExpenseButton,
} from "@/components/accounting/expense-dialog";
import {
  EXPENSE_TYPES,
  EXPENSE_TYPE_LABELS,
  EXPENSE_STATUSES,
  EXPENSE_STATUS_LABELS,
} from "@/lib/validators/accounting";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Receipt } from "lucide-react";
import { hasPermission } from "@/lib/permissions";

export const metadata = { title: "Expenses" };

type SP = Record<string, string | string[] | undefined>;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const me = await requirePermission("expenses:read");
  const sp = await searchParams;
  const { page, pageSize, skip } = parseListParams(sp);
  const type = typeof sp.type === "string" ? sp.type : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const canApprove = hasPermission(me.role, "expenses:approve");
  const canWrite = hasPermission(me.role, "expenses:write");

  // Drivers only see their own expenses
  let driverProfileId: string | undefined;
  if (me.role === "DRIVER") {
    const dp = await prisma.driverProfile.findFirst({
      where: { userId: me.id },
      select: { id: true },
    });
    driverProfileId = dp?.id;
  }

  const where = {
    companyId: me.companyId ?? undefined,
    ...(driverProfileId ? { driverId: driverProfileId } : {}),
    ...(type ? { type: type as never } : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [items, total, agg, loads, trucks, drivers] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip,
      take: pageSize,
      include: {
        load: { select: { referenceNumber: true } },
        truck: { select: { plateNumber: true } },
        driver: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
    prisma.load.findMany({
      where: me.companyId ? { companyId: me.companyId } : {},
      select: { id: true, referenceNumber: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.truck.findMany({
      where: me.companyId ? { companyId: me.companyId } : {},
      select: { id: true, plateNumber: true },
      orderBy: { plateNumber: "asc" },
    }),
    prisma.driverProfile.findMany({
      where: me.companyId ? { companyId: me.companyId } : {},
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    }),
  ]);

  const opts = {
    loads: loads.map((l) => ({ id: l.id, label: l.referenceNumber })),
    trucks: trucks.map((t) => ({ id: t.id, label: t.plateNumber })),
    drivers: drivers.map((d) => ({
      id: d.id,
      label: `${d.firstName} ${d.lastName}`,
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description={`${total} records · Total ${formatCurrency(agg._sum.amount ?? 0)}`}
        action={canWrite ? <ExpenseFormDialog {...opts} /> : null}
      />
      <div className="flex flex-wrap gap-3">
        <FilterSelect
          paramKey="type"
          allLabel="All types"
          options={EXPENSE_TYPES.map((t) => ({
            value: t,
            label: EXPENSE_TYPE_LABELS[t],
          }))}
        />
        <FilterSelect
          paramKey="status"
          allLabel="All statuses"
          options={EXPENSE_STATUSES.map((s) => ({
            value: s,
            label: EXPENSE_STATUS_LABELS[s],
          }))}
        />
      </div>

      <div className="rounded-lg border bg-card">
        {items.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-10 w-10" />}
            title="No expenses found"
            description="Record your first expense."
            action={canWrite ? <ExpenseFormDialog {...opts} /> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Load / Truck / Driver</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">
                    {formatDate(e.occurredAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {EXPENSE_TYPE_LABELS[
                        e.type as keyof typeof EXPENSE_TYPE_LABELS
                      ] ?? e.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {e.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {[
                      e.load?.referenceNumber,
                      e.truck?.plateNumber,
                      e.driver
                        ? `${e.driver.firstName} ${e.driver.lastName}`
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(e.amount, e.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        e.status === "APPROVED"
                          ? "default"
                          : e.status === "REJECTED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {EXPENSE_STATUS_LABELS[
                        e.status as keyof typeof EXPENSE_STATUS_LABELS
                      ] ?? e.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {canApprove && e.status === "PENDING" && (
                        <ExpenseDecisionButtons expenseId={e.id} />
                      )}
                      {canWrite && <DeleteExpenseButton expenseId={e.id} />}
                    </div>
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
