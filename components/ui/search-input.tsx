"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  placeholder?: string;
  paramKey?: string;
}

/**
 * URL-driven search input with debounce. Updates the `q` (or custom) query
 * param and lets server components re-fetch.
 */
export function SearchInput({
  placeholder = "Caută...",
  paramKey = "q",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(paramKey) ?? "");
  const [, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params);
      if (value) sp.set(paramKey, value);
      else sp.delete(paramKey);
      sp.delete("page");
      startTransition(() => {
        router.replace(`${pathname}?${sp.toString()}`);
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-8 pr-8"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Șterge"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
