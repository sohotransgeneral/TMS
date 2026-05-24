"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Props {
  dateFrom?: string;
  dateTo?: string;
}

export function DateRangeFilter({ dateFrom, dateTo }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [from, setFrom] = useState(dateFrom ?? "");
  const [to, setTo] = useState(dateTo ?? "");
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const sp = new URLSearchParams(params);
    if (value) sp.set(key, value);
    else sp.delete(key);
    sp.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={from}
        onChange={(e) => { setFrom(e.target.value); update("dateFrom", e.target.value); }}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        title="Pickup from"
      />
      <span className="text-muted-foreground text-xs">→</span>
      <input
        type="date"
        value={to}
        onChange={(e) => { setTo(e.target.value); update("dateTo", e.target.value); }}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        title="Pickup to"
      />
    </div>
  );
}
