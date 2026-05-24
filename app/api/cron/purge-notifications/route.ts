import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Daily cron: delete notifications older than 30 days.
 * Scheduled via vercel.json -> "0 3 * * *" (03:00 UTC).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` header
 * when CRON_SECRET is set in env. We accept either that or no secret in dev.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const res = await prisma.notification.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return NextResponse.json({
    ok: true,
    deleted: res.count,
    cutoff: cutoff.toISOString(),
  });
}
