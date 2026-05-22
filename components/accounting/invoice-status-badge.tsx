import { cn } from "@/lib/utils";
import { INVOICE_STATUS_LABELS } from "@/lib/validators/accounting";

const COLOR: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  OVERDUE: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  CANCELLED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        COLOR[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {INVOICE_STATUS_LABELS[status] ?? status}
    </span>
  );
}
