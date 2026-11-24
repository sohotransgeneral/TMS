import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import { loadDriverPdfInput, renderDriverReportPdf } from "@/lib/driver-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const me = await requirePermission("drivers:read");
  const { id } = await ctx.params;
  const params = new URL(req.url).searchParams;
  const period = params.get("period") ?? "week";
  // Whose name and email head the report: the driver (default) or the truck owner.
  const party = params.get("party") === "owner" ? "owner" : "driver";

  const input = await loadDriverPdfInput(me.companyId, id, period, party);
  if (!input) return new NextResponse("Not found", { status: 404 });

  const name = input.reportName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const when = input.data.periodLabel.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new NextResponse(new Uint8Array(renderDriverReportPdf(input)), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-${name}-${when}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
