import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import {
  computeDeadhead,
  type DeadheadResult,
  type LocationParts,
} from "@/lib/load-miles";
import { drivingMiles, resolvePoint } from "@/lib/distance";

/**
 * Live mileage for the load form: loaded miles pickup → delivery, plus the
 * deadhead from the selected driver's previous drop when a driver is chosen.
 *
 * The same numbers are recomputed server-side when the load is saved — this
 * route only exists so the dispatcher sees miles and $/mile while typing.
 */

export const runtime = "nodejs";

type Body = {
  pickup?: LocationParts;
  delivery?: LocationParts;
  driverId?: string;
  pickupDate?: string;
  excludeLoadId?: string;
};

export async function POST(req: NextRequest) {
  let me: Awaited<ReturnType<typeof requirePermission>>;
  try {
    me = await requirePermission("loads:write");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const pickup = body.pickup ?? {};
  const delivery = body.delivery ?? {};

  // Resolved here rather than inside a helper because the caller needs the
  // coordinates too — the form draws the trip on a map before the load exists.
  const [pickupPoint, deliveryPoint] = await Promise.all([
    resolvePoint(pickup),
    resolvePoint(delivery),
  ]);
  const miles = await drivingMiles(pickupPoint, deliveryPoint);

  let deadhead: DeadheadResult | null = null;
  const pickupDate = body.pickupDate ? new Date(body.pickupDate) : null;
  if (
    me.companyId &&
    body.driverId &&
    pickupDate &&
    !Number.isNaN(pickupDate.getTime())
  ) {
    deadhead = await computeDeadhead({
      companyId: me.companyId,
      driverId: body.driverId,
      pickup,
      pickupDate,
      excludeLoadId: body.excludeLoadId,
    });
  }

  return NextResponse.json({
    ok: true,
    miles,
    deadheadMiles: deadhead?.miles ?? null,
    deadheadOrigin: deadhead?.origin ?? null,
    pickupPoint,
    deliveryPoint,
    deadheadFrom: deadhead?.from ?? null,
  });
}
