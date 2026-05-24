import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { uploadPrivate } from "@/lib/r2";
import { DocumentType } from "@prisma/client";

// Max 20 MB per file
const MAX_SIZE = 20 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export async function POST(req: NextRequest) {
  const me = await requirePermission("documents:write");

  const formData = await req.formData();

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Allowed: PDF, JPEG, PNG, WEBP, GIF, HEIC.` },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });
  }

  const typeParam = formData.get("type") as string | null;
  if (!typeParam || !(typeParam in DocumentType)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }
  const docType = typeParam as DocumentType;

  const name = (formData.get("name") as string | null) || file.name;
  const loadId = (formData.get("loadId") as string | null) || undefined;
  const truckId = (formData.get("truckId") as string | null) || undefined;
  const trailerId = (formData.get("trailerId") as string | null) || undefined;
  const driverProfileId = (formData.get("driverProfileId") as string | null) || undefined;
  const customerId = (formData.get("customerId") as string | null) || undefined;
  const invoiceId = (formData.get("invoiceId") as string | null) || undefined;
  const expiresAtParam = formData.get("expiresAt") as string | null;
  const expiresAt = expiresAtParam ? new Date(expiresAtParam) : undefined;

  // Determine companyId — for SUPER_ADMIN derive from the linked entity
  let companyId = me.companyId;
  if (!companyId) {
    if (loadId) {
      const load = await prisma.load.findUnique({ where: { id: loadId }, select: { companyId: true } });
      companyId = load?.companyId ?? null;
    } else if (truckId) {
      const truck = await prisma.truck.findUnique({ where: { id: truckId }, select: { companyId: true } });
      companyId = truck?.companyId ?? null;
    } else if (driverProfileId) {
      const dp = await prisma.driverProfile.findUnique({ where: { id: driverProfileId }, select: { companyId: true } });
      companyId = dp?.companyId ?? null;
    }
  }

  if (!companyId) {
    return NextResponse.json({ error: "Cannot determine companyId for this document" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { key, sizeBytes } = await uploadPrivate(buffer, file.name);

  const doc = await prisma.document.create({
    data: {
      companyId,
      type: docType,
      name,
      url: key,
      mimeType: file.type,
      sizeBytes,
      expiresAt,
      loadId,
      truckId,
      trailerId,
      driverProfileId,
      customerId,
      invoiceId,
      uploadedById: me.id,
    },
  });

  return NextResponse.json({ ok: true, document: doc }, { status: 201 });
}
