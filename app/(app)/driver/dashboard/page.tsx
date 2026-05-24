import Link from "next/link";
import { redirect } from "next/navigation";
import { Truck, MapPin, ClipboardList, Phone, Package, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadStatusBadge } from "@/components/loads/load-status-badge";
import { LoadStatusButton } from "@/components/loads/load-status-button";
import { AcceptLoadButton } from "@/components/driver/accept-load-button";
import { GpsTracker } from "@/components/driver/gps-tracker";
import { DriverZoneMap } from "@/components/driver/driver-zone-map";
import { PermitList } from "@/components/fleet/permit-list";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "My Loads" };

const ACTIVE_STATUSES = [
  "DRIVER_ACCEPTED",
  "ON_WAY_TO_PICKUP",
  "AT_PICKUP",
  "LOADED",
  "IN_TRANSIT",
  "AT_DELIVERY",
];

export default async function DriverDashboardPage() {
  const user = await requireUser();
  if (user.role !== "DRIVER" && user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const driver = await prisma.driverProfile.findUnique({
    where: { userId: user.id },
  });

  if (!driver) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Driver profile not configured. Contact your administrator.
        </CardContent>
      </Card>
    );
  }

  const [activeLoad, assigned, history] = await Promise.all([
    prisma.load.findFirst({
      where: { driverId: driver.id, status: { in: ACTIVE_STATUSES as never } },
      orderBy: { pickupDate: "asc" },
      include: {
        customer: { select: { name: true, contactPerson: true, phone: true } },
      },
    }),
    prisma.load.findMany({
      where: { driverId: driver.id, status: "ASSIGNED" },
      orderBy: { pickupDate: "asc" },
      include: { customer: { select: { name: true } } },
    }),
    prisma.load.findMany({
      where: {
        driverId: driver.id,
        status: {
          in: ["DELIVERED", "POD_UPLOADED", "INVOICED", "PAID"] as never,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  // Fetch permits for the truck currently assigned to the driver's active load
  const activeTruckId = activeLoad?.truckId ?? null;
  const permits = activeTruckId
    ? await prisma.truckPermit.findMany({
        where: { truckId: activeTruckId },
        orderBy: { validTo: "asc" },
      })
    : [];

  return (
    <div className="space-y-6">
      {activeLoad && <GpsTracker loadId={activeLoad.id} />}

      <div>
        <h1 className="text-2xl font-bold">Hello, {driver.firstName}!</h1>
        <p className="text-sm text-muted-foreground">
          Status: <Badge variant="success">{driver.status}</Badge>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Active Load"
          value={activeLoad ? 1 : 0}
          icon={ClipboardList}
          tone="info"
        />
        <StatCard
          label="To Accept"
          value={assigned.length}
          icon={Truck}
          tone="warning"
        />
      </div>

      {activeLoad ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Active Load</CardTitle>
            <LoadStatusBadge status={activeLoad.status} />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="font-semibold">{activeLoad.referenceNumber}</div>
              {activeLoad.customer && (
                <div className="text-sm text-muted-foreground">
                  {activeLoad.customer.name}
                </div>
              )}
            </div>

            <div className="grid gap-3">
              <RouteRow
                label="Pickup"
                color="text-emerald-600"
                address={activeLoad.pickupAddress}
                city={activeLoad.pickupCity}
                country={activeLoad.pickupCountry}
                when={activeLoad.pickupDate}
                lat={activeLoad.pickupLat}
                lng={activeLoad.pickupLng}
              />
              <RouteRow
                label="Delivery"
                color="text-rose-600"
                address={activeLoad.deliveryAddress}
                city={activeLoad.deliveryCity}
                country={activeLoad.deliveryCountry}
                when={activeLoad.deliveryDate}
                lat={activeLoad.deliveryLat}
                lng={activeLoad.deliveryLng}
              />
            </div>

            {activeLoad.cargoDescription && (
              <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm">
                <Package className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div>{activeLoad.cargoDescription}</div>
                  {activeLoad.weightKg && (
                    <div className="text-xs text-muted-foreground">
                      {activeLoad.weightKg} kg
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeLoad.customer?.phone && (
              <a
                href={`tel:${activeLoad.customer.phone}`}
                className="flex items-center gap-2 rounded-md border p-3 text-sm hover:bg-accent"
              >
                <Phone className="h-4 w-4" />
                Call client: {activeLoad.customer.phone}
              </a>
            )}

            <div className="flex gap-2">
              <LoadStatusButton
                loadId={activeLoad.id}
                current={activeLoad.status}
              />
              <Button asChild variant="outline">
                <Link href={`/dispatch/loads/${activeLoad.id}`}>Details</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No active load in progress.
          </CardContent>
        </Card>
      )}

      {assigned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>To Accept</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {assigned.map((l) => (
              <div key={l.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{l.referenceNumber}</p>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {l.pickupCity ?? l.pickupAddress} →{" "}
                      {l.deliveryCity ?? l.deliveryAddress}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(l.pickupDate, true)}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {formatCurrency(l.price, l.currency)}
                  </span>
                </div>
                <div className="mt-3">
                  <AcceptLoadButton loadId={l.id} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          )}
          {history.map((l) => (
            <Link
              key={l.id}
              href={`/dispatch/loads/${l.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent"
            >
              <div>
                <div className="font-medium">{l.referenceNumber}</div>
                <div className="text-xs text-muted-foreground">
                  {l.pickupCity ?? l.pickupAddress} →{" "}
                  {l.deliveryCity ?? l.deliveryAddress}
                </div>
              </div>
              <LoadStatusBadge status={l.status} />
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Permits for active truck */}
      {permits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-500" />
              Active Truck Permits
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Special permits for this truck. Show these to authorities when requested.
            </p>
          </CardHeader>
          <CardContent>
            <PermitList permits={permits} truckId={activeTruckId!} canEdit={false} />
          </CardContent>
        </Card>
      )}

      {/* Zone availability map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Zone Availability
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tap the map to mark zones — green (no issues), yellow (costly), red
            (can&apos;t go). Tap a pin again to cycle its status. Dispatchers
            can see your pins in real time.
          </p>
        </CardHeader>
        <CardContent>
          <DriverZoneMap token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}

function RouteRow({
  label,
  color,
  address,
  city,
  country,
  when,
  lat,
  lng,
}: {
  label: string;
  color: string;
  address: string;
  city: string | null;
  country: string | null;
  when: Date;
  lat: number | null;
  lng: number | null;
}) {
  const navHref =
    lat != null && lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address} ${city ?? ""} ${country ?? ""}`)}`;
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <MapPin className={`mt-0.5 h-4 w-4 ${color}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{address}</div>
        <div className="text-xs text-muted-foreground">
          {[city, country].filter(Boolean).join(", ")}
        </div>
        <div className="mt-1 text-xs">{formatDate(when, true)}</div>
      </div>
      <a
        href={navHref}
        target="_blank"
        rel="noreferrer"
        className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
      >
        Navigate
      </a>
    </div>
  );
}
