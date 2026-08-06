"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteLoad } from "@/actions/loads";

/**
 * Deleting a load takes its documents, status history and GPS pings with it,
 * so the dialog names the load and warns when the trip is already under way —
 * "L-2026-00016" in the prompt is what stops the wrong tab being deleted.
 */
export function DeleteLoadButton({
  loadId,
  referenceNumber,
  status,
}: {
  loadId: string;
  referenceNumber: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const started = !["DRAFT", "ASSIGNED", "CANCELLED"].includes(status);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Trash2 className="mr-2 h-4 w-4" /> Delete
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete load {referenceNumber}?</DialogTitle>
          <DialogDescription>
            This removes the load together with its documents, status history
            and GPS trail. Expenses and fuel already booked against it are kept.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {started && (
          <p className="rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            This load is already in progress ({status}). Make sure it is not a
            trip the driver is actually running.
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteLoad(loadId);
                if (res.ok) {
                  toast.success(res.message ?? "Load deleted.");
                  setOpen(false);
                  router.push("/dispatch/loads");
                } else {
                  toast.error(res.error);
                }
              })
            }
          >
            {pending ? "Deleting…" : "Delete load"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
