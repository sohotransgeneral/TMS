import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export async function GET(req: NextRequest) {
  const me = await requirePermission("documents:read");
  const { searchParams } = new URL(req.url);

  const loadId = searchParams.get("loadId") ?? undefined;
  const truckId = searchParams.get("truckId") ?? undefined;
  const trailerId = searchParams.get("trailerId") ?? undefined;
  const driverProfileId = searchParams.get("driverProfileId") ?? undefined;
  const customerId = searchParams.get("customerId") ?? undefined;
  const invoiceId = searchParams.get("invoiceId") ?? undefined;

  const companyFilter = me.companyId ? { companyId: me.companyId } : {};

  const documents = await prisma.document.findMany({
    where: {
      ...companyFilter,
      ...(loadId ? { loadId } : {}),
      ...(truckId ? { truckId } : {}),
      ...(trailerId ? { trailerId } : {}),
      ...(driverProfileId ? { driverProfileId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(invoiceId ? { invoiceId } : {}),
    },
    include: {
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ documents });
}
