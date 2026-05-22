import { requirePermission } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
import { LiveMap } from "@/components/dispatch/live-map";

export const metadata = { title: "Hartă live" };

export default async function MapPage() {
  await requirePermission("gps:read");
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hartă live"
        description="Pozițiile curente ale șoferilor pe curse active."
      />
      <LiveMap token={token} />
    </div>
  );
}
