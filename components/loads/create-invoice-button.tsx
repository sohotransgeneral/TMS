"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createInvoiceFromLoad } from "@/actions/invoices";

export function CreateInvoiceButton({ loadId }: { loadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const res = await createInvoiceFromLoad(loadId);
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
