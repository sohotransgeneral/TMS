import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
}

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  destructive: "bg-red-500/15 text-red-700 dark:text-red-400",
  info: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-5 flex items-start justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground leading-tight">{label}</p>
          <p className="text-xl sm:text-2xl font-semibold mt-0.5 sm:mt-1 truncate">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              "h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-lg grid place-items-center",
              toneClasses[tone],
            )}
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
