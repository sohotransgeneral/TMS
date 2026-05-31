"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-helpers";

export function CreateInvoiceButton({
  action,
}: {
  action: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        setDone(true);
        toast.success(res.message ?? "Invoice created.");
        const id = (res.data as { id?: string } | undefined)?.id;
        if (id) router.push(`/accounting/invoices/${id}`);
        else router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={pending || done}
    >
      <FileText className="mr-2 h-4 w-4" />
      {pending ? "Creating…" : "Create Invoice"}
    </Button>
  );
}
