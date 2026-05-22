import { NextResponse } from "next/server";
import { pingGps } from "@/actions/gps";

/** POST /api/gps  — body: { lat, lng, speed?, heading?, accuracy?, loadId? } */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalid" }, { status: 400 });
  }
  const res = await pingGps(body);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
