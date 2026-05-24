"use client";

import { useRef, useState, useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { toActionState } from "@/lib/to-action-state";
import { createPermit, updatePermit } from "@/actions/permits";
import { PERMIT_TYPES } from "@/lib/permit-types";
import type { ActionResult } from "@/lib/action-helpers";
import {
  Upload,
  Loader2,
  FileText,
  X,
  ShieldCheck,
  Plus,
  Pencil,
} from "lucide-react";

type Permit = {
  id: string;
  type: string;
  permitNumber: string | null;
  jurisdiction: string | null;
  description: string | null;
  validFrom: Date | string | null;
  validTo: Date | string | null;
  cost: number | null;
  currency: string;
  permitImageUrl: string | null;
  invoiceUrl: string | null;
  notes: string | null;
};

function toDateInput(val: Date | string | null | undefined) {
  if (!val) return "";
  try {
    return new Date(val).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function FileUploadField({
  label,
  name,
  initial,
}: {
  label: string;
  name: string;
  initial?: string | null;
}) {
  const [url, setUrl] = useState(initial ?? "");
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/permits/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Upload failed");
      setUrl(json.url);
      toast.success(`${label} uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload error");
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-2">
        {url ? (
          <>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-primary hover:bg-accent"
            >
              <FileText className="h-3.5 w-3.5" /> View file
            </a>
            <button
              type="button"
              onClick={() => setUrl("")}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => ref.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload {label}
          </Button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {url && (
        <p className="text-xs text-muted-foreground truncate max-w-xs">
          {url.split("/").pop()}
        </p>
      )}
    </div>
  );
}

export function PermitFormDialog({
  truckId,
  initial,
  trigger,
}: {
  truckId: string;
  initial?: Permit;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!initial;
  const action = toActionState(isEdit ? updatePermit : createPermit);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(
        state.message ?? (isEdit ? "Permit updated." : "Permit added."),
      );
      setOpen(false);
    } else {
      toast.error(state.error ?? "Error");
    }
  }, [state, isEdit]);

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-500" />
              {isEdit ? "Edit Permit" : "Add Permit"}
            </DialogTitle>
          </DialogHeader>

          <form action={formAction} className="grid gap-4">
            {isEdit && <input type="hidden" name="id" value={initial.id} />}
            <input type="hidden" name="truckId" value={truckId} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="type" label="Permit Type" required>
                <Select
                  name="type"
                  defaultValue={initial?.type ?? "OVERSIZE"}
                  required
                >
                  {PERMIT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field name="permitNumber" label="Permit Number">
                <Input
                  name="permitNumber"
                  defaultValue={initial?.permitNumber ?? ""}
                  placeholder="e.g. OH-2026-00123"
                />
              </Field>
            </div>

            <Field name="jurisdiction" label="Jurisdiction / State / Route">
              <Input
                name="jurisdiction"
                defaultValue={initial?.jurisdiction ?? ""}
                placeholder="e.g. Ohio, I-80 corridor"
              />
            </Field>

            <Field name="description" label="Description (dimensions / limits)">
              <Input
                name="description"
                defaultValue={initial?.description ?? ""}
                placeholder="e.g. 14'6&quot; wide, 120ft long, 105,500 lbs"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="validFrom" label="Valid From">
                <Input
                  name="validFrom"
                  type="date"
                  defaultValue={toDateInput(initial?.validFrom)}
                />
              </Field>
              <Field name="validTo" label="Valid To">
                <Input
                  name="validTo"
                  type="date"
                  defaultValue={toDateInput(initial?.validTo)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="cost" label="Permit Cost">
                <Input
                  name="cost"
                  type="number"
                  step="0.01"
                  defaultValue={initial?.cost ?? ""}
                  placeholder="0.00"
                />
              </Field>
              <Field name="currency" label="Currency">
                <Select
                  name="currency"
                  defaultValue={initial?.currency ?? "USD"}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="RON">RON</option>
                </Select>
              </Field>
            </div>

            {/* File uploads */}
            <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
              <FileUploadField
                label="Permit Document"
                name="permitImageUrl"
                initial={initial?.permitImageUrl}
              />
              <FileUploadField
                label="Invoice / Receipt"
                name="invoiceUrl"
                initial={initial?.invoiceUrl}
              />
            </div>

            <Field name="notes" label="Notes">
              <Textarea
                name="notes"
                rows={2}
                defaultValue={initial?.notes ?? ""}
                placeholder="Any additional notes..."
              />
            </Field>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : isEdit ? "Save Changes" : "Add Permit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NewPermitButton({ truckId }: { truckId: string }) {
  return (
    <PermitFormDialog
      truckId={truckId}
      trigger={
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add Permit
        </Button>
      }
    />
  );
}

export function EditPermitButton({
  permit,
  truckId,
}: {
  permit: Permit;
  truckId: string;
}) {
  return (
    <PermitFormDialog
      truckId={truckId}
      initial={permit}
      trigger={
        <Button size="icon" variant="ghost" className="h-7 w-7">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      }
    />
  );
}
