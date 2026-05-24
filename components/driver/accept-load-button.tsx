"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptLoad } from "@/actions/loads";

export function AcceptLoadButton({ loadId }: { loadId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await acceptLoad(loadId);
      if (result.ok) toast.success(result.message ?? "Load accepted.");
      else toast.error(result.error);
    });
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="w-full cursor-pointer"
    >
      {pending ? "Sending…" : "✓ Accept load"}
    </Button>
  );
}
