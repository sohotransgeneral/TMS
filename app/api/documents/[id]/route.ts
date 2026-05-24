import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { deletePrivate } from "@/lib/r2";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requirePermission("documents:write");
  const { id } = await params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (me.companyId && doc.companyId !== me.companyId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  await prisma.document.update({
    where: { id },
    data: { expiresAt },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requirePermission("documents:write");
  const { id } = await params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // SUPER_ADMIN can delete any; others can only delete their company's docs
  if (me.companyId && doc.companyId !== me.companyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deletePrivate(doc.url);
  await prisma.document.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
