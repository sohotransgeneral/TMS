import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { LiveMap } from "@/components/dispatch/live-map";

export const metadata = { title: "Live map" };

export default async function MapPage() {
  await requirePermission("gps:read");
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Live map"
        description="Current driver positions on active loads."
      />
      <LiveMap token={token} />
    </div>
  );
}
