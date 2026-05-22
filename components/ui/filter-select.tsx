"use client";

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

/** URL-driven dropdown filter (status, type, etc.). */
export function FilterSelect({ paramKey, options, allLabel = "Toate" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(paramKey) ?? "";

  return (
    <Select
      value={current}
      onChange={(e) => {
        const sp = new URLSearchParams(params);
        if (e.target.value) sp.set(paramKey, e.target.value);
        else sp.delete(paramKey);
        sp.delete("page");
        router.replace(`${pathname}?${sp.toString()}`);
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
