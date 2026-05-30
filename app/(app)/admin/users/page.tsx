import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { parseListParams, buildSearch } from "@/lib/action-helpers";
import { PageHeader } from "@/components/dashboard/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { FilterSelect } from "@/components/ui/filter-select";
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
import { NewUserButton } from "@/components/users/user-form-dialog";
import { UserRowActions } from "@/components/users/user-row-actions";
import { ROLE_LABELS } from "@/lib/permissions";
import { Users } from "lucide-react";

export const metadata = { title: "Utilizatori" };

type SP = Record<string, string | string[] | undefined>;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const me = await requirePermission("users:read");
  const sp = await searchParams;
  const { page, pageSize, q, skip } = parseListParams(sp);
  const role = typeof sp.role === "string" ? sp.role : undefined;
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const isSuperAdmin = me.role === "SUPER_ADMIN";

  const where = {
    ...(me.companyId ? { companyId: me.companyId } : {}),
    ...(role ? { role: role as never } : {}),
    ...(status === "active"
      ? { active: true }
      : status === "inactive"
        ? { active: false }
        : {}),
    ...buildSearch(q, ["name", "email", "phone"]),
  };

  const [users, total, companies, customers, trucks, trailers] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        telegramChatId: true,
        role: true,
        active: true,
        createdAt: true,
        company: { select: { name: true } },
        customerProfiles: { select: { id: true, name: true }, take: 1 },
        driverProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            cnp: true,
            licenseNumber: true,
            licenseCategories: true,
            licenseIssuedAt: true,
            licenseExpiresAt: true,
            tachoCardNumber: true,
            tachoCardExpiresAt: true,
            status: true,
            salaryType: true,
            salaryPerKm: true,
            salaryFixedAmount: true,
            grossPercent: true,
            commissionRate: true,
            taxCas: true,
            taxCass: true,
            taxImpozit: true,
            internalNotes: true,
            truckId: true,
            trailerId: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
    isSuperAdmin
      ? prisma.company.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    me.companyId
      ? prisma.customer.findMany({
          where: { companyId: me.companyId },
          select: { id: true, name: true, email: true, userId: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    me.companyId
      ? prisma.truck.findMany({
          where: { companyId: me.companyId },
          select: { id: true, plateNumber: true, fleetNumber: true },
          orderBy: { fleetNumber: "asc" },
        })
      : Promise.resolve([]),
    me.companyId
      ? prisma.trailer.findMany({
          where: { companyId: me.companyId },
          select: { id: true, plateNumber: true, fleetNumber: true },
          orderBy: { fleetNumber: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilizatori"
        description="Team members with access to the platform."
        action={<NewUserButton companies={companies} customers={customers} />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search by name, email…" />
        <FilterSelect
          paramKey="role"
          allLabel="Toate rolurile"
          options={Object.entries(ROLE_LABELS)
            .filter(([k]) => k !== "SUPER_ADMIN")
            .map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          paramKey="status"
          allLabel="Toate statusurile"
          options={[
            { value: "active", label: "Activi" },
            { value: "inactive", label: "Inactivi" },
          ]}
        />
      </div>

      <div className="rounded-lg border bg-card">
        {users.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            title="No users found"
            description="Add primul membru al echipei."
            action={
              <NewUserButton companies={companies} customers={customers} />
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                {isSuperAdmin && <TableHead>Company</TableHead>}
                <TableHead>Rol</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name ?? "—"}</TableCell>
                  <TableCell>
                    <div>{u.email}</div>
                    {u.role === "CUSTOMER" && u.customerProfiles[0] && (
                      <div className="text-xs text-muted-foreground">
                        📦 {u.customerProfiles[0].name}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{u.phone ?? "—"}</TableCell>
                  {isSuperAdmin && (
                    <TableCell className="text-muted-foreground text-sm">
                      {u.company?.name ?? "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant="secondary">
                      {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ??
                        u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.active ? (
                      <Badge>Activ</Badge>
                    ) : (
                      <Badge variant="outline">Inactiv</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <UserRowActions
                      user={{
                        ...u,
                        linkedCustomer: u.customerProfiles[0] ?? null,
                        customers,
                        driverProfile: u.driverProfile ?? null,
                      }}
                      isSelf={u.id === me.id}
                      trucks={trucks.map((t) => ({
                        id: t.id,
                        label: `${t.fleetNumber != null ? `#${t.fleetNumber} · ` : ""}${t.plateNumber}`,
                      }))}
                      trailers={trailers.map((t) => ({
                        id: t.id,
                        label: `${t.fleetNumber != null ? `#${t.fleetNumber} · ` : ""}${t.plateNumber}`,
                      }))}
                    />
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
