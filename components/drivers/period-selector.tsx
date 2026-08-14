"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPeriodRange, shiftPeriod } from "@/lib/period";

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const TABS = [
  { unit: "today", label: "Today" },
  { unit: "week", label: "Week" },
  { unit: "month", label: "Month" },
  { unit: "year", label: "Year" },
] as const;

/**
 * Period picker for the driver report: the four usual spans, arrows to step
 * back through them, and a custom range.
 *
 * Which period is shown lives in the URL, so a report can be linked, reloaded
 * or exported to PDF and still show the same numbers.
 */
export function PeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("period") ?? "week";
  const range = getPeriodRange(current);

  const [customOpen, setCustomOpen] = useState(range.unit === "range");
  // toISOString would shift these into UTC and show the day before for anyone
  // east of Greenwich — the inputs want the local calendar date.
  const [from, setFrom] = useState(() => localDate(range.from));
  const [to, setTo] = useState(() => localDate(range.to));

  const set = useCallback(
    (p: string) => {
      const sp = new URLSearchParams(params.toString());
      sp.set("period", p);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [router, pathname, params],
  );

  const previous = shiftPeriod(current, -1);
  const next = shiftPeriod(current, 1);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex w-fit overflow-hidden rounded-lg border border-border">
        {TABS.map((t) => (
          <button
            key={t.unit}
            type="button"
            onClick={() => {
              setCustomOpen(false);
              set(t.unit);
            }}
            className={cn(
              "px-4 py-1.5 text-sm font-medium transition-colors",
              range.unit === t.unit
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          title="Custom range"
          className={cn(
            "flex items-center gap-1.5 border-l border-border px-3 py-1.5 text-sm font-medium transition-colors",
            range.unit === "range"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          <CalendarRange className="h-4 w-4" />
          Range
        </button>
      </div>

      {/* Stepping through periods. "Next" disappears on the current one —
          there are no numbers to report from next week. */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!previous}
          onClick={() => previous && set(previous)}
          title="Previous period"
          className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[11rem] text-center text-sm font-medium">
          {range.label}
        </span>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && set(next)}
          title="Next period"
          className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {customOpen && (
        <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="h-7 rounded border border-input bg-background px-1.5 text-xs [color-scheme:light] dark:[color-scheme:dark]"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="h-7 rounded border border-input bg-background px-1.5 text-xs [color-scheme:light] dark:[color-scheme:dark]"
          />
          <button
            type="button"
            disabled={!from || !to || from > to}
            onClick={() => set(`range:${from}..${to}`)}
            className="h-7 rounded bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
