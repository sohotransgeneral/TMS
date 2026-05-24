import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getSignedDownloadUrl } from "@/lib/r2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requirePermission("documents:read");
  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: {
      id,
      // Non-super-admins may only access their own company's documents
      ...(me.companyId ? { companyId: me.companyId } : {}),
    },
    select: { url: true },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl(doc.url);
  return NextResponse.json({ url: signedUrl });
}
