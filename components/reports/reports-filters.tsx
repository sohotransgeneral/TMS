"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type Driver = { id: string; firstName: string; lastName: string };
type Truck = { id: string; plateNumber: string };

export function ReportsFilters({
  drivers,
  trucks,
}: {
  drivers: Driver[];
  trucks: Truck[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`/reports?${params.toString()}`);
    },
    [router, sp],
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={sp.get("driverId") ?? ""}
        onChange={(e) => update("driverId", e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All drivers</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.firstName} {d.lastName}
          </option>
        ))}
      </select>

      <select
        value={sp.get("truckId") ?? ""}
        onChange={(e) => update("truckId", e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All trucks</option>
        {trucks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.plateNumber}
          </option>
        ))}
      </select>

      {(sp.get("driverId") || sp.get("truckId")) && (
        <button
          onClick={() => router.replace("/reports")}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
