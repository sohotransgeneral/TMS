"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  page: number;
  pageSize: number;
  total: number;
}

export function Pagination({ page, pageSize, total }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const makeHref = (p: number) => {
    const sp = new URLSearchParams(params);
    sp.set("page", String(p));
    return `${pathname}?${sp.toString()}`;
  };

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 py-3 px-4 border-t flex-wrap">
      <p className="text-sm text-muted-foreground">
        {start}–{end} din {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={page <= 1}
          className={page <= 1 ? "pointer-events-none opacity-50" : ""}
        >
          <Link href={makeHref(page - 1)} prefetch={false}>
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Link>
        </Button>
        <span className="text-sm px-3">
          Pagina {page} / {totalPages}
        </span>
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
        >
          <Link href={makeHref(page + 1)} prefetch={false}>
            Următor
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
