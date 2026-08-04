import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import { loadedMiles, computeDeadhead, type LocationParts } from "@/lib/load-miles";

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

  const miles = await loadedMiles(pickup, delivery);

  let deadhead: { miles: number; origin: string } | null = null;
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
  });
}
