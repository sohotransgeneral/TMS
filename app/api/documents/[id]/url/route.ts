import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getSignedDownloadUrl } from "@/lib/r2";

// Allowed expiry presets in seconds
const EXPIRY_PRESETS: Record<string, number> = {
  "15m":  15 * 60,
  "1h":   60 * 60,
  "6h":   6 * 60 * 60,
  "24h":  24 * 60 * 60,
  "7d":   7 * 24 * 60 * 60,
};
const DEFAULT_EXPIRY = EXPIRY_PRESETS["1h"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requirePermission("documents:read");
  const { id } = await params;

  const expiresParam = req.nextUrl.searchParams.get("expires") ?? "1h";
  const expiresIn = EXPIRY_PRESETS[expiresParam] ?? DEFAULT_EXPIRY;

  const doc = await prisma.document.findFirst({
    where: {
      id,
      ...(me.companyId ? { companyId: me.companyId } : {}),
    },
    select: { url: true },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl(doc.url, expiresIn);
  return NextResponse.json({ url: signedUrl, expiresIn });
}
