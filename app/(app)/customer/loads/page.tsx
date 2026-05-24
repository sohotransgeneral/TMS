import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadStatusBadge } from "@/components/loads/load-status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Package } from "lucide-react";

export const metadata = { title: "My Loads" };

export default async function CustomerLoadsPage() {
  const me = await requirePermission("loads:read_own");

  // Find the Customer record linked to this portal user
  const customer = me.companyId
    ? await prisma.customer.findFirst({
        where: { companyId: me.companyId, userId: me.id },
      })
    : null;

  const loads = customer
    ? await prisma.load.findMany({
        where: { customerId: customer.id },
        orderBy: { pickupDate: "desc" },
        take: 200,
        select: {
          id: true,
          referenceNumber: true,
          pickupCity: true,
          pickupCountry: true,
          deliveryCity: true,
          deliveryCountry: true,
          pickupDate: true,
          deliveryDate: true,
          status: true,
          price: true,
          currency: true,
          driver: { select: { firstName: true, lastName: true } },
          truck: { select: { plateNumber: true } },
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Loads"
        description={
          customer
            ? `Loads for ${customer.name}`
            : "Your assigned loads will appear here."
        }
      />

      {loads.length === 0 ? (
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="No loads yet"
          description={
            customer
              ? "No loads have been assigned to your account yet."
              : "Your account is not linked to a customer profile. Contact your dispatcher."
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref. No.</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Pickup Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Truck</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loads.map((load) => (
                <TableRow key={load.id}>
                  <TableCell className="font-mono font-medium text-sm">
                    {load.referenceNumber}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{load.pickupCity ?? "—"}</div>
                    {load.pickupCountry && (
                      <div className="text-xs text-muted-foreground">
                        {load.pickupCountry}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {load.deliveryCity ?? "—"}
                    </div>
                    {load.deliveryCountry && (
                      <div className="text-xs text-muted-foreground">
                        {load.deliveryCountry}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>{formatDate(load.pickupDate)}</div>
                    {load.deliveryDate && (
                      <div className="text-xs text-muted-foreground">
                        → {formatDate(load.deliveryDate)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <LoadStatusBadge status={load.status} />
                  </TableCell>
                  <TableCell>
                    {load.driver
                      ? `${load.driver.firstName} ${load.driver.lastName}`
                      : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {load.truck?.plateNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(load.price, load.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
