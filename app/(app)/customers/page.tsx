import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { parseListParams, buildSearch } from "@/lib/action-helpers";
import { PageHeader } from "@/components/dashboard/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  NewCustomerButton,
  CustomerRowActions,
} from "@/components/customers/customer-form-dialog";
import { formatCurrency } from "@/lib/utils";
import { Building2 } from "lucide-react";

export const metadata = { title: "Customers" };

type SP = Record<string, string | string[] | undefined>;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const me = await requirePermission("customers:read");
  const sp = await searchParams;
  const { page, pageSize, q, skip } = parseListParams(sp);

  const where = {
    companyId: me.companyId ?? undefined,
    ...buildSearch(q, ["name", "taxId", "email", "city"]),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
      include: {
        _count: { select: { loads: true, invoices: true } },
        user: { select: { email: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Your transport partners."
        action={<NewCustomerButton />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search by name, VAT, email…" />
      </div>

      <div className="rounded-lg border bg-card">
        {customers.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-10 w-10" />}
            title="No customers found"
            description="Add your first partner to start recording loads."
            action={<NewCustomerButton />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>VAT / CUI</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Credit Limit</TableHead>
                <TableHead>Loads / Invoices</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    {c.city && (
                      <div className="text-xs text-muted-foreground">
                        {[c.city, c.country].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{c.taxId ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {c.contactPerson && <div>{c.contactPerson}</div>}
                    {c.email && (
                      <div className="text-muted-foreground">{c.email}</div>
                    )}
                    {c.phone && (
                      <div className="text-muted-foreground">{c.phone}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.paymentTermsDays ?? 30} days
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.creditLimit ? formatCurrency(c.creditLimit) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c._count.loads} / {c._count.invoices}
                  </TableCell>
                  <TableCell>
                    <CustomerRowActions customer={{ ...c, user: c.user ?? null }} />
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
