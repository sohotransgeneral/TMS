"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: "today", label: "Azi" },
  { value: "week", label: "Week" },
  { value: "month", label: "Luna" },
  { value: "year", label: "Anul" },
] as const;

export function PeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("period") ?? "week";

  const set = useCallback(
    (p: string) => {
      const sp = new URLSearchParams(params.toString());
      sp.set("period", p);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [router, pathname, params],
  );

  return (
    <div className="flex rounded-lg border border-border overflow-hidden w-fit">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => set(p.value)}
          className={cn(
            "px-4 py-1.5 text-sm font-medium transition-colors",
            current === p.value
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
