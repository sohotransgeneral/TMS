"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The company report as a PDF. For an external driver there is a tick to head
 * the report with the truck owner's name and email instead of the driver's.
 */
export function ReportPdfButton({
  driverId,
  period,
  ownerLabel,
}: {
  driverId: string;
  period: string;
  /** Set for an external driver: the owner (or company) the tick refers to. */
  ownerLabel: string | null;
}) {
  const [asOwner, setAsOwner] = useState(false);
  const href = `/api/drivers/${driverId}/report-pdf?period=${encodeURIComponent(period)}${
    ownerLabel && asOwner ? "&party=owner" : ""
  }`;

  return (
    <div className="flex items-center gap-3">
      {ownerLabel && (
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={asOwner}
            onChange={(e) => setAsOwner(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Show truck owner ({ownerLabel}) on the report
        </label>
      )}
      <Button asChild variant="outline" size="sm">
        <a href={href}>
          <FileDown className="mr-2 h-4 w-4" />
          PDF
        </a>
      </Button>
    </div>
  );
}
