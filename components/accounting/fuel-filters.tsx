"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FilterSelect } from "@/components/ui/filter-select";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string };

interface Props {
  trucks: Opt[];
  drivers: Opt[];
}

type Preset = "today" | "week" | "month" | "year" | "all";

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangeFor(preset: Preset): { from: string; to: string } | null {
  if (preset === "all") return null;
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);
  if (preset === "week") {
    const day = (now.getDay() + 6) % 7;
    from.setDate(now.getDate() - day);
    to.setDate(from.getDate() + 6);
  } else if (preset === "month") {
    from.setDate(1);
    to.setMonth(now.getMonth() + 1, 0);
  } else if (preset === "year") {
    from.setMonth(0, 1);
    to.setMonth(11, 31);
  }
  return { from: iso(from), to: iso(to) };
}

export function FuelFilters({ trucks, drivers }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const currentPreset = (params.get("period") as Preset) ?? "all";
  const dateFrom = params.get("dateFrom") ?? "";
  const dateTo = params.get("dateTo") ?? "";
  const hasAnyFilter =
    params.get("truck") ||
    params.get("driver") ||
    params.get("period") ||
    dateFrom ||
    dateTo;

  function applyPreset(preset: Preset) {
    const sp = new URLSearchParams(params);
    const r = rangeFor(preset);
    if (preset === "all" || !r) {
      sp.delete("period");
      sp.delete("dateFrom");
      sp.delete("dateTo");
    } else {
      sp.set("period", preset);
      sp.set("dateFrom", r.from);
      sp.set("dateTo", r.to);
    }
    sp.delete("page");
    startTransition(() => router.replace(`${pathname}?${sp.toString()}`));
  }

  function updateDate(key: "dateFrom" | "dateTo", value: string) {
    const sp = new URLSearchParams(params);
    if (value) sp.set(key, value);
    else sp.delete(key);
    sp.delete("period");
    sp.delete("page");
    startTransition(() => router.replace(`${pathname}?${sp.toString()}`));
  }

  function clearAll() {
    startTransition(() => router.replace(pathname));
  }

  const presets: { key: Preset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => {
          const active =
            currentPreset === p.key &&
            (p.key !== "all" ||
              !hasAnyFilter ||
              (!dateFrom && !dateTo && !params.get("period")));
          const realActive =
            p.key === "all"
              ? !params.get("period") && !dateFrom && !dateTo
              : currentPreset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className={cn(
                "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                realActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted",
              )}
            >
              {p.label}
            </button>
          );
        })}

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => updateDate("dateFrom", e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            title="From"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => updateDate("dateTo", e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            title="To"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {hasAnyFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-8 text-xs"
            >
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterSelect paramKey="truck" options={trucks} allLabel="All trucks" />
        <FilterSelect
          paramKey="driver"
          options={drivers}
          allLabel="All drivers"
        />
      </div>
    </div>
  );
}
