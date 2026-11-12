import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PeriodSelector } from "@/components/drivers/period-selector";
import { getPeriodRange } from "@/lib/period";
import { getPartnerStats } from "@/lib/partner-stats";
import { formatCurrency } from "@/lib/utils";

/**
 * How the loads of external drivers were split in a period: per company, what
 * we kept, what the drivers got and what is owed to the company they belong to.
 */
export async function PartnerStats({
  companyId,
  period,
  currency,
}: {
  companyId?: string;
  period: string;
  currency: string;
}) {
  const range = getPeriodRange(period);
  const rows = await getPartnerStats(companyId, range.from, range.to);
  if (rows.length === 0) return null;

  const sum = (pick: (r: (typeof rows)[number]) => number) =>
    rows.reduce((s, r) => s + pick(r), 0);

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Partner companies</h3>
          <p className="text-xs text-muted-foreground">
            External drivers · {range.label} · delivered loads, split of the
            load total. Permits are taken from the company share.
          </p>
        </div>
        <PeriodSelector defaultPeriod="month" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead className="text-right">Drivers</TableHead>
            <TableHead className="text-right">Loads</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">We keep</TableHead>
            <TableHead className="text-right">Drivers</TableHead>
            <TableHead className="text-right">Permits</TableHead>
            <TableHead className="text-right">Owed to company</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.company}>
              <TableCell className="font-medium">{r.company}</TableCell>
              <TableCell className="text-right tabular-nums">{r.drivers}</TableCell>
              <TableCell className="text-right tabular-nums">{r.loads}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(r.total, currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(r.our, currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(r.driver, currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.permits > 0 ? `-${formatCurrency(r.permits, currency)}` : "—"}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatCurrency(r.partner, currency)}
              </TableCell>
            </TableRow>
          ))}
          {rows.length > 1 && (
            <TableRow className="border-t-2 font-semibold">
              <TableCell>All companies</TableCell>
              <TableCell className="text-right tabular-nums">
                {sum((r) => r.drivers)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {sum((r) => r.loads)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(sum((r) => r.total), currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(sum((r) => r.our), currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(sum((r) => r.driver), currency)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {sum((r) => r.permits) > 0
                  ? `-${formatCurrency(sum((r) => r.permits), currency)}`
                  : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(sum((r) => r.partner), currency)}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
