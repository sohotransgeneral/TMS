"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Paperclip, Loader2, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createDispatcherAdjustment,
  deleteDispatcherAdjustment,
} from "@/actions/dispatcher-adjustments";

export type DispatcherAdjustment = {
  id: string;
  label: string;
  amount: number;
  proofUrl: string | null;
  createdAt: Date | string;
};

/**
 * Bonuses and deductions on top of a dispatcher's commission, for the period
 * currently on screen. Amounts are entered positive and the Type select
 * decides the sign — typing "-200" for a deduction is the kind of thing that
 * silently becomes +200 when someone forgets the minus.
 */
export function DispatcherAdjustmentsPanel({
  userId,
  periodKey,
  periodLabel,
  currency,
  adjustments,
}: {
  userId: string;
  periodKey: string;
  periodLabel: string;
  currency: string;
  adjustments: DispatcherAdjustment[];
}) {
  const money = (v: number) =>
    Math.abs(v).toLocaleString("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    });

  const total = adjustments.reduce((s, a) => s + a.amount, 0);

  return (
    <section className="space-y-3 rounded-lg border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Bonuses &amp; deductions</h3>
          <p className="text-xs text-muted-foreground">
            Applies to {periodLabel}. Recorded against this period, so it stays
            put when you look at another one.
          </p>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Net: </span>
          <span
            className={`font-mono font-semibold ${total < 0 ? "text-destructive" : ""}`}
          >
            {total < 0 ? "−" : "+"}
            {money(total)}
          </span>
        </div>
      </div>

      <AddForm userId={userId} periodKey={periodKey} />

      {adjustments.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted-foreground">
          Nothing recorded for this period.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {adjustments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex-1">{a.label}</span>
              {a.proofUrl && <ProofLink objectKey={a.proofUrl} />}
              <span
                className={`font-mono font-medium ${a.amount < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
              >
                {a.amount < 0 ? "−" : "+"}
                {money(a.amount)}
              </span>
              <DeleteButton id={a.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddForm({ userId, periodKey }: { userId: string; periodKey: string }) {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [proof, setProof] = useState<{ key: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Clearing the form belongs to the submit that succeeded, not to a render
  // that happens to observe the new state.
  function submit(formData: FormData) {
    start(async () => {
      const res = await createDispatcherAdjustment(formData);
      if (res.ok) {
        toast.success(res.message ?? "Saved.");
        formRef.current?.reset();
        setProof(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/proof", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Upload failed");
      setProof({ key: json.url, name: json.name ?? file.name });
      toast.success("Proof attached.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3"
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="periodKey" value={periodKey} />
      <input type="hidden" name="proofUrl" value={proof?.key ?? ""} />

      <div className="min-w-[10rem] flex-1">
        <Label htmlFor="adj-label">Reason</Label>
        <Input id="adj-label" name="label" placeholder="Bonus, advance…" required />
      </div>
      <div className="w-28">
        <Label htmlFor="adj-type">Type</Label>
        <Select id="adj-type" name="sign" defaultValue="bonus">
          <option value="bonus">Bonus</option>
          <option value="deduction">Deduction</option>
        </Select>
      </div>
      <div className="w-32">
        <Label htmlFor="adj-amount">Amount</Label>
        <Input
          id="adj-amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          required
        />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
        className="hidden"
        onChange={upload}
      />
      {proof ? (
        <span className="flex h-9 items-center gap-1 rounded-md border bg-background px-2 text-xs">
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[8rem] truncate">{proof.name}</span>
          <button
            type="button"
            onClick={() => setProof(null)}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="mr-1.5 h-4 w-4" />
          )}
          Proof
        </Button>
      )}

      <Button type="submit" disabled={pending || uploading}>
        <Plus className="mr-1.5 h-4 w-4" />
        {pending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}

function ProofLink({ objectKey }: { objectKey: string }) {
  const [loading, setLoading] = useState(false);

  async function open() {
    // Stored value is an R2 key; older rows may hold a plain URL.
    if (/^(https?:)?\/\//.test(objectKey) || objectKey.startsWith("/")) {
      window.open(objectKey, "_blank", "noopener,noreferrer");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/uploads/proof?key=${encodeURIComponent(objectKey)}`,
      );
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open the proof.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      title="Open proof"
      className="text-muted-foreground hover:text-primary"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ExternalLink className="h-4 w-4" />
      )}
    </button>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  function remove(formData: FormData) {
    start(async () => {
      const res = await deleteDispatcherAdjustment(formData);
      if (res.ok) toast.success(res.message ?? "Deleted.");
      else toast.error(res.error);
    });
  }
  return (
    <form action={remove}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive"
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
