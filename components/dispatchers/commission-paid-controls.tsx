"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  setLoadCommissionPaid,
  markCommissionPaid,
} from "@/actions/dispatcher-payouts";

/** Per-load tick in the commission table. */
export function PaidToggle({
  loadId,
  paid,
}: {
  loadId: string;
  paid: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      title={paid ? "Paid — click to undo" : "Mark this commission as paid"}
      onClick={() =>
        start(async () => {
          const res = await setLoadCommissionPaid(loadId, !paid);
          if (res.ok) toast.success(res.message ?? "Saved.");
          else toast.error(res.error);
        })
      }
      className={`flex h-5 w-5 items-center justify-center rounded border transition-colors disabled:opacity-50 ${
        paid
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-input hover:border-emerald-600"
      }`}
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : paid ? (
        <Check className="h-3.5 w-3.5" />
      ) : null}
    </button>
  );
}

/**
 * Settles every outstanding load on screen at once.
 *
 * The ids come from what is rendered, so a load created while the page was
 * open can't be settled without anyone having seen it.
 */
export function SettleAllButton({
  dispatcherId,
  loadIds,
  outstandingCount,
  outstandingLabel,
}: {
  dispatcherId: string;
  loadIds: string[];
  outstandingCount: number;
  outstandingLabel: string;
}) {
  const [pending, start] = useTransition();
  if (outstandingCount === 0) return null;

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await markCommissionPaid(dispatcherId, loadIds, true);
          if (res.ok) toast.success(res.message ?? "Saved.");
          else toast.error(res.error);
        })
      }
    >
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Check className="mr-2 h-4 w-4" />
      )}
      Mark {outstandingCount} load{outstandingCount === 1 ? "" : "s"} paid (
      {outstandingLabel})
    </Button>
  );
}
