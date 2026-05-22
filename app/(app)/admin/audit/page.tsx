import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { parseListParams } from "@/lib/action-helpers";
import { PageHeader } from "@/components/dashboard/page-header";
import { FilterSelect } from "@/components/ui/filter-select";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { ScrollText } from "lucide-react";

export const metadata = { title: "Jurnal audit" };

type SP = Record<string, string | string[] | undefined>;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const me = await requirePermission("audit:read");
  const sp = await searchParams;
  const { page, pageSize, q, skip } = parseListParams(sp);
  const action = typeof sp.action === "string" ? sp.action : undefined;
  const entity = typeof sp.entity === "string" ? sp.entity : undefined;

  const where = {
    ...(me.companyId ? { companyId: me.companyId } : {}),
    ...(action
      ? { action: { contains: action, mode: "insensitive" as const } }
      : {}),
    ...(entity ? { entityType: entity } : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" as const } },
            { entityType: { contains: q, mode: "insensitive" as const } },
            { entityId: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [logs, total, distinctEntities] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where: me.companyId ? { companyId: me.companyId } : {},
      distinct: ["entityType"],
      select: { entityType: true },
      take: 50,
    }),
  ]);

  const entityOptions = distinctEntities
    .map((e) => e.entityType)
    .filter((v): v is string => Boolean(v))
    .map((v) => ({ value: v, label: v }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jurnal audit"
        description={`${total} evenimente înregistrate.`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Caută acțiune, entitate, ID…" />
        <FilterSelect
          paramKey="entity"
          allLabel="Toate entitățile"
          options={entityOptions}
        />
      </div>

      <div className="rounded-lg border bg-card">
        {logs.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-10 w-10" />}
            title="Niciun eveniment"
            description="Acțiunile importante vor apărea aici."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Utilizator</TableHead>
                <TableHead>Acțiune</TableHead>
                <TableHead>Entitate</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Detalii</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatDate(l.createdAt, true)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.user?.name ?? l.user?.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{l.action}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.entityType ? (
                      <>
                        <div>{l.entityType}</div>
                        {l.entityId && (
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {l.entityId.slice(-8)}
                          </div>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.ipAddress ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-md">
                    {l.meta ? (
                      <pre className="overflow-hidden truncate text-[10px] text-muted-foreground">
                        {JSON.stringify(l.meta)}
                      </pre>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination total={total} page={page} pageSize={pageSize} />
    </div>
  );
}
