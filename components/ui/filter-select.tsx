"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

interface Option {
  value: string;
  label: string;
}

interface Props {
  paramKey: string;
  options: Option[];
  placeholder?: string;
  allLabel?: string;
}

/** URL-driven dropdown filter (status, type, etc.) with optimistic updates. */
export function FilterSelect({ paramKey, options, allLabel = "Toate" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(paramKey) ?? "");
  const [, startTransition] = useTransition();

  return (
    <Select
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next); // optimistic — UI updates immediately
        const sp = new URLSearchParams(params);
        if (next) sp.set(paramKey, next);
        else sp.delete(paramKey);
        sp.delete("page");
        startTransition(() => {
          router.replace(`${pathname}?${sp.toString()}`);
        });
      }}
      className="w-full sm:max-w-[220px]"
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
