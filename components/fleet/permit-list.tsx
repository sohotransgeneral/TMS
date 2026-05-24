"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { deletePermit } from "@/actions/permits";
import { PERMIT_TYPES } from "@/lib/permit-types";
import { EditPermitButton, LogPermitExpenseButton } from "./permit-form-dialog";
import {
  ShieldCheck,
  FileText,
  Receipt,
  Trash2,
  AlertTriangle,
  CalendarClock,
  ExternalLink,
} from "lucide-react";

export type PermitItem = {
  id: string;
  type: string;
  permitNumber: string | null;
  jurisdiction: string | null;
  description: string | null;
  validFrom: Date | string | null;
  validTo: Date | string | null;
  cost: number | null;
  currency: string;
  permitImageUrl: string | null;
  invoiceUrl: string | null;
  notes: string | null;
  createdAt: Date | string;
};

function statusBadge(validTo: Date | string | null) {
  if (!validTo) return <Badge variant="secondary">No expiry</Badge>;
  const d = new Date(validTo);
  const now = new Date();
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return <Badge variant="destructive">Expired</Badge>;
  if (diff < 14)
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-600">
        Expires in {Math.ceil(diff)}d
      </Badge>
    );
  return (
    <Badge variant="default" className="bg-green-600">
      Active
    </Badge>
  );
}

function typeLabel(type: string) {
  return PERMIT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function PermitList({
  permits,
  truckId,
  canEdit = true,
}: {
  permits: PermitItem[];
  truckId: string;
  canEdit?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm("Delete this permit?")) return;
    startTransition(async () => {
      const res = await deletePermit(id);
      if (res.ok) toast.success("Permit deleted.");
      else toast.error(res.error);
    });
  }

  if (permits.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
        <ShieldCheck className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No permits added yet.</p>
        {canEdit && (
          <p className="text-xs text-muted-foreground">
            Add oversize, overweight or other special permits.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {permits.map((p) => (
        <div key={p.id} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="font-semibold text-sm">{typeLabel(p.type)}</span>
            </div>
            <div className="flex items-center gap-1">
              {statusBadge(p.validTo)}
              {canEdit && (
                <>
                  <LogPermitExpenseButton
                    permitId={p.id}
                    cost={p.cost}
                    currency={p.currency}
                  />
                  <EditPermitButton permit={p} truckId={truckId} />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(p.id)}
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {p.permitNumber && (
            <p className="text-xs font-mono text-muted-foreground">
              #{p.permitNumber}
            </p>
          )}

          {p.jurisdiction && (
            <p className="text-sm text-muted-foreground">{p.jurisdiction}</p>
          )}

          {p.description && (
            <div className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {p.description}
            </div>
          )}

          {(p.validFrom || p.validTo) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              {p.validFrom ? formatDate(p.validFrom) : "—"} →{" "}
              {p.validTo ? formatDate(p.validTo) : "—"}
            </div>
          )}

          {p.cost != null && (
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-xs text-muted-foreground">Permit Cost</span>
              <span className="font-semibold text-sm">
                {formatCurrency(p.cost, p.currency)}
              </span>
            </div>
          )}

          {/* Document links */}
          <div className="flex flex-wrap gap-2 border-t pt-2">
            {p.permitImageUrl && (
              <a
                href={p.permitImageUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-accent"
              >
                <FileText className="h-3.5 w-3.5 text-blue-500" />
                Permit <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {p.invoiceUrl && (
              <a
                href={p.invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs hover:bg-accent"
              >
                <Receipt className="h-3.5 w-3.5 text-green-500" />
                Invoice <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {!p.permitImageUrl && !p.invoiceUrl && canEdit && (
              <span className="text-xs text-muted-foreground">
                No documents uploaded
              </span>
            )}
          </div>

          {p.notes && (
            <p className="text-xs text-muted-foreground italic">{p.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}
