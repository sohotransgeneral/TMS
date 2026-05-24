"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      onClick={() => window.print()}
      variant="outline"
      size="sm"
      className="print:hidden"
    >
      <Printer className="mr-2 h-4 w-4" />
      Download / Print PDF
    </Button>
  );
}
