import Link from "next/link";
import { LOAD_STATUS_LABELS } from "@/lib/validators/load";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ASSIGNED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  DRIVER_ACCEPTED:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  ON_WAY_TO_PICKUP:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  AT_PICKUP:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  LOADED:
    "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  IN_TRANSIT:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  AT_DELIVERY: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  DELIVERED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  POD_UPLOADED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  INVOICED: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  PAID: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  CANCELLED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

export function LoadStatusBadge({
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
        STATUS_COLOR[status] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {LOAD_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export { STATUS_COLOR as LOAD_STATUS_COLOR };
export function loadHref(id: string) {
  return `/dispatch/loads/${id}`;
}
export function LoadRefLink({
  id,
  referenceNumber,
}: {
  id: string;
  referenceNumber: string;
}) {
  return (
    <Link
      href={loadHref(id)}
      className="font-medium text-primary hover:underline"
    >
      {referenceNumber}
    </Link>
  );
}
