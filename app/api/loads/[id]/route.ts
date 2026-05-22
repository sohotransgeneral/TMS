import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { LOAD_STATUSES } from "@/lib/validators/load";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(LOAD_STATUSES),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await requireUser();
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const load = await prisma.load.findFirst({
    where: { id, companyId: me.companyId ?? undefined },
  });
  if (!load) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.load.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json(updated);
}
