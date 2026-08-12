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
 * so the dialog names the load — "L-2026-00016" in the prompt is what stops the
 * wrong row being deleted — and spells out the two cases worth pausing over: a
 * trip already under way, and a load that has been invoiced.
 *
 * `icon` is the compact form for table rows; the full button is used on the
 * load page, where it also navigates away afterwards since the page it was
 * showing no longer exists.
 */
export function DeleteLoadButton({
  loadId,
  referenceNumber,
  status,
  invoiceNumber,
  icon = false,
  redirectTo,
}: {
  loadId: string;
  referenceNumber: string;
  status: string;
  invoiceNumber?: string | null;
  icon?: boolean;
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const started = !["DRAFT", "ASSIGNED", "CANCELLED"].includes(status);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {icon ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={`Delete ${referenceNumber}`}
          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete load {referenceNumber}?</DialogTitle>
          <DialogDescription>
            This removes the load together with its documents, status history
            and GPS trail. Expenses and fuel already booked against it are kept.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {invoiceNumber && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Invoice <span className="font-medium">{invoiceNumber}</span> and any
            payments recorded against it are deleted with this load. That
            revenue disappears from the accounting and the reports.
          </p>
        )}

        {started && !invoiceNumber && (
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
                  if (redirectTo) router.push(redirectTo);
                  else router.refresh();
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
