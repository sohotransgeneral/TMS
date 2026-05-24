"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, ImageIcon, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toActionState } from "@/lib/to-action-state";
import {
  createDriverAdjustment,
  deleteDriverAdjustment,
} from "@/actions/driver-adjustments";
import type { ActionResult } from "@/lib/action-helpers";

type Adjustment = {
  id: string;
  label: string;
  amount: number;
  proofUrl: string | null;
  createdAt: Date;
};

function fmt(v: number) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Math.abs(v));
}

/* ── Delete button ────────────────────────────────────────── */
function DeleteAdjustmentButton({ id }: { id: string }) {
  const [, formAction, pending] = useActionState<ActionResult | null, FormData>(
    toActionState(deleteDriverAdjustment),
    null,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer"
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </form>
  );
}

/* ── Add form ─────────────────────────────────────────────── */
function AddAdjustmentForm({
  driverProfileId,
  periodKey,
}: {
  driverProfileId: string;
  periodKey: string;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(toActionState(createDriverAdjustment), null);

  const [sign, setSign] = useState<"bonus" | "deduction">("deduction");
  const [proofUrl, setProofUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Ajustare adăugată.");
      formRef.current?.reset();
      setProofUrl("");
    } else {
      toast.error(state.error ?? "Eroare.");
    }
  }, [state]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-proof", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.url) setProofUrl(data.url);
      else toast.error("Upload eșuat.");
    } catch {
      toast.error("Upload eșuat.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 pt-3 border-t border-border"
    >
      <input type="hidden" name="driverProfileId" value={driverProfileId} />
      <input type="hidden" name="periodKey" value={periodKey} />
      <input type="hidden" name="sign" value={sign} />
      <input type="hidden" name="proofUrl" value={proofUrl} />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Descriere</Label>
          <Input
            name="label"
            placeholder="e.g. Amendă autostradă, Avans, Bonus"
            required
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Tip</Label>
          <Select
            value={sign}
            onChange={(e) => setSign(e.target.value as "bonus" | "deduction")}
            className="h-8 w-32 text-sm"
          >
            <option value="deduction">➖ Deducere</option>
            <option value="bonus">➕ Bonus</option>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Sumă (EUR)</Label>
          <Input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            required
            className="h-8 w-28 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Proof upload */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs cursor-pointer"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
          )}
          {proofUrl ? "Dovadă atașată ✓" : "Atașează dovadă"}
        </Button>
        {proofUrl && (
          <a
            href={proofUrl}
            target="_blank"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" /> Vezi
          </a>
        )}

        <Button
          type="submit"
          size="sm"
          className="ml-auto h-8 text-xs cursor-pointer"
          disabled={pending || uploading}
        >
          {pending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-3.5 w-3.5" />
          )}
          Adaugă
        </Button>
      </div>
    </form>
  );
}

/* ── Main panel ───────────────────────────────────────────── */
export function DriverAdjustmentsPanel({
  driverProfileId,
  periodKey,
  adjustments,
}: {
  driverProfileId: string;
  periodKey: string;
  adjustments: Adjustment[];
}) {
  const bonuses = adjustments.filter((a) => a.amount > 0);
  const deductions = adjustments.filter((a) => a.amount < 0);
  const total = adjustments.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="space-y-3">
      {adjustments.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Fără ajustări manuale în această perioadă.
        </p>
      )}

      {deductions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Deduceri
          </p>
          <div className="divide-y divide-border rounded-md border border-border">
            {deductions.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{a.label}</span>
                  {a.proofUrl && (
                    <a
                      href={a.proofUrl}
                      target="_blank"
                      className="shrink-0 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-red-500 font-semibold">
                    -{fmt(a.amount)}
                  </span>
                  <DeleteAdjustmentButton id={a.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bonuses.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Bonusuri
          </p>
          <div className="divide-y divide-border rounded-md border border-border">
            {bonuses.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{a.label}</span>
                  {a.proofUrl && (
                    <a
                      href={a.proofUrl}
                      target="_blank"
                      className="shrink-0 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-green-600 font-semibold">
                    +{fmt(a.amount)}
                  </span>
                  <DeleteAdjustmentButton id={a.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {adjustments.length > 0 && (
        <div className="flex justify-end text-sm">
          <span className="text-muted-foreground mr-2">Total ajustări:</span>
          <span
            className={`font-mono font-bold ${total >= 0 ? "text-green-600" : "text-red-500"}`}
          >
            {total >= 0 ? "+" : ""}
            {fmt(total)}
          </span>
        </div>
      )}

      <AddAdjustmentForm
        driverProfileId={driverProfileId}
        periodKey={periodKey}
      />
    </div>
  );
}
