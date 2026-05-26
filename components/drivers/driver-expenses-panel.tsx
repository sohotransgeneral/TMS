"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setExpenseChargedTo } from "@/actions/expenses";
import { Building2, UserRound } from "lucide-react";
import { EXPENSE_TYPE_LABELS } from "@/lib/validators/accounting";

export type DriverExpenseRow = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  occurredAt: Date | string;
  chargedTo: string;
  status: string;
  load: { referenceNumber: string } | null;
};

function fmt(v: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(v);
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function ChargedToToggle({
  expenseId,
  chargedTo,
}: {
  expenseId: string;
  chargedTo: string;
}) {
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = chargedTo === "DRIVER" ? "COMPANY" : "DRIVER";
    startTransition(async () => {
      const res = await setExpenseChargedTo(expenseId, next);
      if (!res.ok) toast.error(res.error);
    });
  };

  const isDriver = chargedTo === "DRIVER";

  return (
    <Button
      variant={isDriver ? "default" : "outline"}
      size="sm"
      onClick={toggle}
      disabled={pending}
      className="h-7 gap-1.5 text-xs"
      title={
        isDriver
          ? "Charged to driver — click to move to company"
          : "Charged to company — click to move to driver"
      }
    >
      {isDriver ? (
        <>
          <UserRound className="h-3 w-3" />
          Driver
        </>
      ) : (
        <>
          <Building2 className="h-3 w-3" />
          Company
        </>
      )}
    </Button>
  );
}

export function DriverExpensesPanel({
  expenses,
}: {
  expenses: DriverExpenseRow[];
}) {
  if (expenses.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No expenses for this driver in this period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-3">Date</th>
            <th className="pb-2 pr-3">Type</th>
            <th className="pb-2 pr-3">Description</th>
            <th className="pb-2 pr-3">Load</th>
            <th className="pb-2 pr-3">Status</th>
            <th className="pb-2 pr-3 text-right">Amount</th>
            <th className="pb-2 text-right">Charged to</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {expenses.map((e) => (
            <tr key={e.id} className="hover:bg-muted/40">
              <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                {fmtDate(e.occurredAt)}
              </td>
              <td className="py-2 pr-3">
                <Badge variant="outline" className="text-xs">
                  {EXPENSE_TYPE_LABELS[e.type] ?? e.type}
                </Badge>
              </td>
              <td className="py-2 pr-3 max-w-[160px] truncate text-muted-foreground">
                {e.description || "—"}
              </td>
              <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                {e.load?.referenceNumber ?? "—"}
              </td>
              <td className="py-2 pr-3">
                <Badge
                  variant={
                    e.status === "APPROVED"
                      ? "default"
                      : e.status === "REJECTED"
                        ? "destructive"
                        : "secondary"
                  }
                  className="text-xs"
                >
                  {e.status}
                </Badge>
              </td>
              <td className="py-2 pr-3 text-right font-semibold tabular-nums">
                {fmt(e.amount, e.currency)}
              </td>
              <td className="py-2 text-right">
                <ChargedToToggle expenseId={e.id} chargedTo={e.chargedTo} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
