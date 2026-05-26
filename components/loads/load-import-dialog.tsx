"use client";

import { useRef, useState, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { createLoad } from "@/actions/loads";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";
import { Upload, Sparkles, FileText, X, AlertCircle } from "lucide-react";

type Opt = { id: string; label: string };

type ExtractedData = {
  referenceNumber?: string | null;
  customerName?: string | null;
  pickupAddress?: string;
  pickupCity?: string | null;
  pickupState?: string | null;
  pickupZip?: string | null;
  pickupCountry?: string | null;
  pickupDate?: string | null;
  pickupWindow?: string | null;
  pickupContact?: string | null;
  pickupPhone?: string | null;
  pickupNotes?: string | null;
  deliveryAddress?: string;
  deliveryCity?: string | null;
  deliveryState?: string | null;
  deliveryZip?: string | null;
  deliveryCountry?: string | null;
  deliveryDate?: string | null;
  deliveryWindow?: string | null;
  deliveryContact?: string | null;
  deliveryPhone?: string | null;
  deliveryNotes?: string | null;
  cargoDescription?: string | null;
  weightKg?: number | null;
  weightLbs?: number | null;
  volumeM3?: number | null;
  packages?: number | null;
  temperature?: string | null;
  isHazardous?: boolean;
  equipmentType?: string | null;
  price?: number | null;
  currency?: string;
  estimatedDistanceKm?: number | null;
  internalNotes?: string | null;
};

const toDateTimeLocal = (val: string | null | undefined) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
  } catch {
    return "";
  }
};

export function LoadImportDialog({
  customers,
  drivers,
  trucks,
  trailers,
}: {
  customers: Opt[];
  drivers: Opt[];
  trucks: Opt[];
  trailers: Opt[];
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const action = toActionState(createLoad);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Load created successfully!");
      setOpen(false);
      const id = (state.data as { id?: string } | undefined)?.id;
      if (id) router.push(`/dispatch/loads/${id}`);
      else router.push("/dispatch/loads");
    } else {
      toast.error(state.error ?? "Failed to create load");
    }
  }, [state, router]);

  function reset() {
    setStep("upload");
    setExtracted(null);
    setFile(null);
    setExtractError(null);
    setExtracting(false);
  }

  function handleOpen() {
    reset();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function handleFile(f: File) {
    setFile(f);
    setExtractError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleExtract() {
    if (!file) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/loads/extract", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.ok)
        throw new Error(json.error ?? "Extraction failed");
      setExtracted(json.data);
      setStep("review");
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  const d = extracted ?? {};

  return (
    <>
      <Button variant="outline" onClick={handleOpen}>
        <Sparkles className="mr-2 h-4 w-4 text-violet-500" />
        Import from document
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) handleClose();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              {step === "upload"
                ? "Import load from document"
                : "Review extracted data"}
            </DialogTitle>
            <DialogDescription>
              {step === "upload"
                ? "Upload a rate confirmation, BOL, or shipper order — AI will fill in the fields automatically."
                : "Review and edit the data extracted by AI, then create the load."}
            </DialogDescription>
          </DialogHeader>

          {/* ── Step 1: Upload ── */}
          {step === "upload" && (
            <div className="grid gap-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors ${
                  dragOver
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                    : "border-border hover:border-violet-400 hover:bg-muted/40"
                }`}
              >
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">
                    Drop file here or click to browse
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Images (JPG, PNG, WEBP) or PDF — max 20MB
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>

              {file && (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-violet-500" />
                  <span className="flex-1 truncate font-medium">
                    {file.name}
                  </span>
                  <span className="text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {extractError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {extractError}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleExtract}
                  disabled={!file || extracting}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {extracting ? (
                    <>
                      <span className="mr-2 animate-spin">⏳</span> Analyzing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" /> Extract with AI
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* ── Step 2: Review form ── */}
          {step === "review" && extracted && (
            <form action={formAction} className="grid gap-6">
              {/* Reference */}
              <section className="grid gap-3 rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold">Reference</h3>
                <Field name="referenceNumber" label="Reference / Load #">
                  <Input
                    name="referenceNumber"
                    defaultValue={d.referenceNumber ?? ""}
                    placeholder="e.g. 1234567 / LOAD-2026-001"
                  />
                </Field>
              </section>

              {/* Customer */}
              <section className="grid gap-3 rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold">Customer</h3>
                {d.customerName && (
                  <p className="text-xs text-muted-foreground">
                    AI detected:{" "}
                    <span className="font-medium text-foreground">
                      {d.customerName}
                    </span>{" "}
                    — select from list if available
                  </p>
                )}
                <Select name="customerId" defaultValue="">
                  <option value="">— spot / no customer —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </section>

              {/* Pickup */}
              <section className="grid gap-3 rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold">Pickup</h3>
                <Field name="pickupAddress" label="Address" required>
                  <Input
                    name="pickupAddress"
                    defaultValue={d.pickupAddress ?? ""}
                    required
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field name="pickupCity" label="City, State ZIP">
                    <Input
                      name="pickupCity"
                      defaultValue={
                        [
                          d.pickupCity,
                          d.pickupState ? `, ${d.pickupState}` : "",
                          d.pickupZip ? ` ${d.pickupZip}` : "",
                        ]
                          .filter(Boolean)
                          .join("")
                          .trim() ||
                        (d.pickupCity ?? "")
                      }
                      placeholder="Houston, TX 77001"
                    />
                  </Field>
                  <Field name="pickupCountry" label="Country">
                    <Input
                      name="pickupCountry"
                      defaultValue={d.pickupCountry ?? "US"}
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field name="pickupDate" label="Date & Time" required>
                    <Input
                      name="pickupDate"
                      type="datetime-local"
                      defaultValue={toDateTimeLocal(d.pickupDate)}
                      required
                    />
                  </Field>
                  <Field name="pickupWindow" label="Pickup Window">
                    <Input
                      name="pickupWindow"
                      defaultValue={d.pickupWindow ?? ""}
                      placeholder="FCFS 08:00-15:00 / By Appt / ASAP"
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field name="pickupContact" label="Contact Person">
                    <Input
                      name="pickupContact"
                      defaultValue={d.pickupContact ?? ""}
                    />
                  </Field>
                  <Field name="pickupPhone" label="Phone">
                    <Input
                      name="pickupPhone"
                      defaultValue={d.pickupPhone ?? ""}
                    />
                  </Field>
                </div>
                <Field name="pickupNotes" label="Pickup Notes">
                  <Textarea
                    name="pickupNotes"
                    rows={2}
                    defaultValue={d.pickupNotes ?? ""}
                  />
                </Field>
              </section>

              {/* Delivery */}
              <section className="grid gap-3 rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold">Delivery</h3>
                <Field name="deliveryAddress" label="Address" required>
                  <Input
                    name="deliveryAddress"
                    defaultValue={d.deliveryAddress ?? ""}
                    required
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field name="deliveryCity" label="City, State ZIP">
                    <Input
                      name="deliveryCity"
                      defaultValue={
                        [
                          d.deliveryCity,
                          d.deliveryState ? `, ${d.deliveryState}` : "",
                          d.deliveryZip ? ` ${d.deliveryZip}` : "",
                        ]
                          .filter(Boolean)
                          .join("")
                          .trim() ||
                        (d.deliveryCity ?? "")
                      }
                      placeholder="Los Angeles, CA 90001"
                    />
                  </Field>
                  <Field name="deliveryCountry" label="Country">
                    <Input
                      name="deliveryCountry"
                      defaultValue={d.deliveryCountry ?? "US"}
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field name="deliveryDate" label="Date & Time" required>
                    <Input
                      name="deliveryDate"
                      type="datetime-local"
                      defaultValue={toDateTimeLocal(d.deliveryDate)}
                      required
                    />
                  </Field>
                  <Field name="deliveryWindow" label="Delivery Window">
                    <Input
                      name="deliveryWindow"
                      defaultValue={d.deliveryWindow ?? ""}
                      placeholder="FCFS 08:00-15:00 / By Appt / ASAP"
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field name="deliveryContact" label="Contact Person">
                    <Input
                      name="deliveryContact"
                      defaultValue={d.deliveryContact ?? ""}
                    />
                  </Field>
                  <Field name="deliveryPhone" label="Phone">
                    <Input
                      name="deliveryPhone"
                      defaultValue={d.deliveryPhone ?? ""}
                    />
                  </Field>
                </div>
                <Field name="deliveryNotes" label="Delivery Notes">
                  <Textarea
                    name="deliveryNotes"
                    rows={2}
                    defaultValue={d.deliveryNotes ?? ""}
                  />
                </Field>
              </section>

              {/* Cargo */}
              <section className="grid gap-3 rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold">Cargo</h3>
                <Field name="cargoDescription" label="Description">
                  <Input
                    name="cargoDescription"
                    defaultValue={d.cargoDescription ?? ""}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field
                    name="weightKg"
                    label={`Weight (${d.weightLbs != null && d.weightKg == null ? "lbs" : "lbs"})`}
                  >
                    <Input
                      name="weightKg"
                      type="number"
                      step="any"
                      min="0"
                      defaultValue={d.weightLbs ?? d.weightKg ?? ""}
                    />
                  </Field>
                  <Field name="volumeM3" label="Volume (m³)">
                    <Input
                      name="volumeM3"
                      type="number"
                      step="0.1"
                      defaultValue={d.volumeM3 ?? ""}
                    />
                  </Field>
                  <Field name="packages" label="Packages">
                    <Input
                      name="packages"
                      type="number"
                      defaultValue={d.packages ?? ""}
                    />
                  </Field>
                  <Field name="temperature" label="Temperature">
                    <Input
                      name="temperature"
                      defaultValue={d.temperature ?? ""}
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isHazardous"
                    defaultChecked={d.isHazardous ?? false}
                  />
                  Hazardous Cargo (ADR)
                </label>
              </section>

              {/* Commercial */}
              <section className="grid gap-3 rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold">Commercial</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field name="price" label="Price" required>
                    <Input
                      name="price"
                      type="number"
                      step="0.01"
                      defaultValue={d.price ?? ""}
                      required
                    />
                  </Field>
                  <Field name="currency" label="Currency">
                    <Select name="currency" defaultValue={d.currency ?? "USD"}>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="RON">RON</option>
                      <option value="GBP">GBP</option>
                    </Select>
                  </Field>
                  <Field name="estimatedDistanceKm" label="Distance (mi)">
                    <Input
                      name="estimatedDistanceKm"
                      type="number"
                      step="any"
                      min="0"
                      defaultValue={d.estimatedDistanceKm ?? ""}
                    />
                  </Field>
                </div>
              </section>

              {/* Assignment */}
              <section className="grid gap-3 rounded-lg border bg-card p-4">
                <h3 className="text-sm font-semibold">Assignment (optional)</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field name="driverId" label="Driver">
                    <Select name="driverId" defaultValue="">
                      <option value="">—</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field name="truckId" label="Truck">
                    <Select name="truckId" defaultValue="">
                      <option value="">—</option>
                      {trucks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field name="trailerId" label="Trailer">
                    <Select name="trailerId" defaultValue="">
                      <option value="">—</option>
                      {trailers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field name="internalNotes" label="Internal Notes">
                  <Textarea
                    name="internalNotes"
                    rows={2}
                    defaultValue={d.internalNotes ?? ""}
                  />
                </Field>
              </section>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("upload")}
                >
                  ← Back
                </Button>
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Creating…" : "Create Load"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
