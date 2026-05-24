import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles, FileText, ImageIcon, DollarSign, TrendingUp } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "AI Usage & Billing" };

function fmtUsd(v: number) {
  return `$${v.toFixed(2)}`;
}

export default async function AiUsagePage() {
  const me = await requirePermission("company:read");
  const isSuperAdmin = me.role === "SUPER_ADMIN";

  if (isSuperAdmin) {
    // ── SUPER ADMIN: all companies breakdown ──────────────────────────────
    const logs = await prisma.aiUsageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        company: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    });

    // Aggregate per company
    const byCompany = new Map<
      string,
      {
        companyName: string;
        count: number;
        realCost: number;
        billed: number;
        profit: number;
      }
    >();

    for (const log of logs) {
      const key = log.companyId ?? "__none__";
      const name = log.company?.name ?? "— no company —";
      const existing = byCompany.get(key) ?? {
        companyName: name,
        count: 0,
        realCost: 0,
        billed: 0,
        profit: 0,
      };
      existing.count += 1;
      existing.realCost += log.realCostUsd;
      existing.billed += log.billedUsd;
      existing.profit += log.billedUsd - log.realCostUsd;
      byCompany.set(key, existing);
    }

    const companyRows = Array.from(byCompany.values()).sort(
      (a, b) => b.billed - a.billed,
    );

    const totals = companyRows.reduce(
      (acc, r) => ({
        count: acc.count + r.count,
        realCost: acc.realCost + r.realCost,
        billed: acc.billed + r.billed,
        profit: acc.profit + r.profit,
      }),
      { count: 0, realCost: 0, billed: 0, profit: 0 },
    );

    return (
      <div className="space-y-6">
        <PageHeader
          title="AI Usage & Billing"
          description="Real cost vs billed across all companies."
        />

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard
            label="Total Extractions"
            value={totals.count.toString()}
            icon={<Sparkles className="h-4 w-4" />}
          />
          <StatCard
            label="Real Cost (OpenAI)"
            value={fmtUsd(totals.realCost)}
            icon={<DollarSign className="h-4 w-4 text-orange-500" />}
            sub="actual API spend"
          />
          <StatCard
            label="Billed to Companies"
            value={fmtUsd(totals.billed)}
            icon={<DollarSign className="h-4 w-4 text-green-500" />}
            sub="$2 per extraction"
          />
          <StatCard
            label="Margin"
            value={fmtUsd(totals.profit)}
            icon={<TrendingUp className="h-4 w-4 text-violet-500" />}
            sub={`${totals.realCost > 0 ? ((totals.profit / totals.billed) * 100).toFixed(0) : 0}% margin`}
          />
        </div>

        {/* Per-company table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Company</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {companyRows.length === 0 ? (
              <EmptyState
                icon={<Sparkles className="h-10 w-10" />}
                title="No AI usage yet"
                description="Extractions will appear here once companies start importing documents."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Extractions</TableHead>
                    <TableHead className="text-right text-orange-600">Real Cost</TableHead>
                    <TableHead className="text-right text-green-600">Billed</TableHead>
                    <TableHead className="text-right text-violet-600">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyRows.map((r) => (
                    <TableRow key={r.companyName}>
                      <TableCell className="font-medium">{r.companyName}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right text-orange-600">{fmtUsd(r.realCost)}</TableCell>
                      <TableCell className="text-right text-green-600">{fmtUsd(r.billed)}</TableCell>
                      <TableCell className="text-right text-violet-600">{fmtUsd(r.profit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Extractions (last 500)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {logs.length === 0 ? null : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right text-orange-600">Real Cost</TableHead>
                    <TableHead className="text-right text-green-600">Billed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell>{log.company?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{log.user?.name ?? log.user?.email ?? "—"}</TableCell>
                      <TableCell>
                        {log.fileType === "image" ? (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <ImageIcon className="h-3 w-3" /> Image
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <FileText className="h-3 w-3" /> PDF
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{log.model}</TableCell>
                      <TableCell className="text-right text-xs">
                        {log.inputTokens + log.outputTokens}
                      </TableCell>
                      <TableCell className="text-right text-xs text-orange-600">
                        {fmtUsd(log.realCostUsd)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-green-600">
                        {fmtUsd(log.billedUsd)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── COMPANY_ADMIN: own company usage only ─────────────────────────────
  const where = { companyId: me.companyId ?? undefined };

  const [logs, totals] = await Promise.all([
    prisma.aiUsageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.aiUsageLog.aggregate({
      where,
      _count: { id: true },
      _sum: { billedUsd: true },
    }),
  ]);

  const count = totals._count.id;
  const totalBilled = totals._sum.billedUsd ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Usage"
        description="Document extractions billed at $2 per upload."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Total Extractions"
          value={count.toString()}
          icon={<Sparkles className="h-4 w-4 text-violet-500" />}
        />
        <StatCard
          label="Total Billed"
          value={fmtUsd(totalBilled)}
          icon={<DollarSign className="h-4 w-4 text-green-600" />}
          sub="$2.00 per AI document scan"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extraction History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-10 w-10" />}
              title="No extractions yet"
              description='Use "Import from document" on the Loads page to scan a rate confirmation.'
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.user?.name ?? log.user?.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      {log.fileType === "image" ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <ImageIcon className="h-3 w-3" /> Image
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <FileText className="h-3 w-3" /> PDF
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {fmtUsd(log.billedUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className="mt-2 text-2xl font-bold">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
