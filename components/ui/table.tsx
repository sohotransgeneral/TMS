import * as React from "react";
import { cn } from "@/lib/utils";

export const Table = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="relative w-full overflow-auto">
    <table
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
);

export const THead = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("[&_tr]:border-b bg-muted/40", className)} {...props} />
);

export const TBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
);

export const TR = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn(
      "border-b transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted",
      className,
    )}
    {...props}
  />
);

export const TH = ({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      "h-10 px-3 text-left align-middle font-medium text-muted-foreground whitespace-nowrap",
      className,
    )}
    {...props}
  />
);

export const TD = ({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td
    className={cn("p-3 align-middle whitespace-nowrap", className)}
    {...props}
  />
);

// Standard shadcn-style aliases
export const TableHeader = THead;
export const TableBody = TBody;
export const TableRow = TR;
export const TableHead = TH;
export const TableCell = TD;
