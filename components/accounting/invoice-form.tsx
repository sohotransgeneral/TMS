"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { createInvoice, updateInvoice } from "@/actions/invoices";
import { formatCurrency } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-helpers";
import { Plus, Trash2 } from "lucide-react";

type Opt = { id: string; label: string };
type ItemRow = { description: string; quantity: number; unitPrice: number };
type LoadData = {
  id: string;
  pickupAddress?: string | null;
  pickupCity?: string | null;
  pickupState?: string | null;
  pickupZip?: string | null;
  deliveryAddress?: string | null;
  deliveryCity?: string | null;
  deliveryState?: string | null;
  deliveryZip?: string | null;
  price?: number | null;
  accessorialAmount?: number | null;
  loadInvoiceNumber?: string | null;
};

export type InvoiceInitial = {
  id: string;
  customerId: string;
  loadId: string | null;
  series: string | null;
  issueDate: Date | string;
  dueDate: Date | string;
  vatRate: number;
  currency: string;
  notes: string | null;
  items: unknown;
};

const toDateInput = (d: Date | string | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60_000).toISOString().slice(0, 10);
};

export function InvoiceForm({
  initial,
  customers,
  loads,
  loadsData = [],
  defaultVatRate,
  defaultCurrency,
  defaultLoadId,
  defaultCustomerId,
  defaultItems,
  defaultSeries,
}: {
  initial?: InvoiceInitial;
  customers: Opt[];
  loads: Opt[];
  loadsData?: LoadData[];
  defaultVatRate: number;
  defaultCurrency: string;
  defaultLoadId?: string | null;
  defaultCustomerId?: string | null;
  defaultItems?: ItemRow[];
  defaultSeries?: string;
}) {
  const editing = Boolean(initial);
  const router = useRouter();
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const initialItems: ItemRow[] = (() => {
    const arr = Array.isArray(initial?.items)
      ? (initial!.items as ItemRow[])
      : [];
    if (arr.length) return arr;
    if (defaultItems?.length) return defaultItems;
    return [{ description: "", quantity: 1, unitPrice: 0 }];
  })();
  const [items, setItems] = useState<ItemRow[]>(initialItems);
  const currency = initial?.currency ?? defaultCurrency;

  const [selectedLoadId, setSelectedLoadId] = useState<string>(
    initial?.loadId ?? defaultLoadId ?? "",
  );
  const [series, setSeries] = useState<string>(
    initial?.series ?? defaultSeries ?? "",
  );

  // Auto-fill from load when selection changes
  useEffect(() => {
    if (!selectedLoadId) return;
    const ld = loadsData.find((l) => l.id === selectedLoadId);
    if (!ld) return;

    function fmtAddr(
      address?: string | null,
      city?: string | null,
      state?: string | null,
      zip?: string | null,
    ) {
      return [address, city, [state, zip].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");
    }

    const pickupFull = fmtAddr(
      ld.pickupAddress,
      ld.pickupCity,
      ld.pickupState,
      ld.pickupZip,
    );
    const deliveryFull = fmtAddr(
      ld.deliveryAddress,
      ld.deliveryCity,
      ld.deliveryState,
      ld.deliveryZip,
    );
    const desc =
      [pickupFull, deliveryFull].filter(Boolean).join(" > ") ||
      "Freight transport";

    const newItems: ItemRow[] = [
      { description: desc, quantity: 1, unitPrice: ld.price ?? 0 },
    ];
    if ((ld.accessorialAmount ?? 0) > 0) {
      newItems.push({
        description: "Accessorial",
        quantity: 1,
        unitPrice: ld.accessorialAmount!,
      });
    }
    setItems(newItems);
    if (ld.loadInvoiceNumber) setSeries(ld.loadInvoiceNumber);
    // if no loadInvoiceNumber, keep the auto-generated preview (defaultSeries)
  }, [selectedLoadId]);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Saved.");
      const id = (state.data as { id?: string } | undefined)?.id ?? initial?.id;
      if (id) router.push(`/accounting/invoices/${id}`);
      else router.push("/accounting/invoices");
    } else toast.error(state.error);
  }, [state, router, initial?.id]);

  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = formRef.current!;
    const fd = new FormData();
    // scalar fields
    const fields = [
      "customerId",
      "loadId",
      "series",
      "issueDate",
      "dueDate",
      "currency",
      "notes",
    ];
    fd.append("vatRate", "0");
    if (editing) fd.append("id", initial!.id);
    for (const f of fields) {
      const el = form.elements.namedItem(f) as
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement
        | null;
      fd.append(f, el?.value ?? "");
    }
    // item rows from state — quantity is always 1, unitPrice = amount
    for (const it of items) {
      fd.append("itemDescription", it.description);
      fd.append("itemQuantity", "1");
      fd.append("itemUnitPrice", String(it.unitPrice));
    }
    startTransition(async () => {
      const result = await (editing ? updateInvoice(fd) : createInvoice(fd));
      setState(result);
    });
  }

  const e = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  const total = items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0,
  );

  const addItem = () =>
    setItems((arr) => [...arr, { description: "", quantity: 1, unitPrice: 0 }]);
  const removeItem = (idx: number) =>
    setItems((arr) => arr.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<ItemRow>) =>
    setItems((arr) =>
      arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid gap-6">
      {editing && <input type="hidden" name="id" value={initial!.id} />}
      {/* Hidden fields for backend compatibility */}
      <input
        type="hidden"
        name="dueDate"
        value={toDateInput(
          initial?.dueDate ?? new Date(Date.now() + 30 * 86400_000),
        )}
      />
      <input type="hidden" name="currency" value={currency} />

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="customerId"
            label="Customer"
            required
            error={e.customerId}
          >
            <Select
              id="customerId"
              name="customerId"
              defaultValue={initial?.customerId ?? defaultCustomerId ?? ""}
              required
            >
              <option value="">— select customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            name="loadId"
            label="Associated Load (optional)"
            error={e.loadId}
          >
            <Select
              id="loadId"
              name="loadId"
              value={selectedLoadId}
              onChange={(ev) => setSelectedLoadId(ev.target.value)}
            >
              <option value="">— no load —</option>
              {loads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="series" label="Invoice #" error={e.series}>
            <Input
              id="series"
              name="series"
              value={series}
              onChange={(ev) => setSeries(ev.target.value)}
              placeholder="e.g.: STL-2026-00022"
            />
          </Field>
          <Field
            name="issueDate"
            label="Issue Date"
            required
            error={e.issueDate}
          >
            <Input
              id="issueDate"
              name="issueDate"
              type="date"
              defaultValue={toDateInput(initial?.issueDate ?? new Date())}
              required
            />
          </Field>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Invoice Lines</h3>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-4 w-4" /> Add Line
          </Button>
        </div>

        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-2">
              <div className="flex-1">
                <Input
                  name="itemDescription"
                  placeholder="Description (e.g. Pickup City > Delivery City)"
                  value={it.description}
                  onChange={(ev) =>
                    updateItem(idx, { description: ev.target.value })
                  }
                  required={idx === 0}
                />
              </div>
              <div className="w-36">
                <Input
                  name="itemUnitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Amount ($)"
                  value={it.unitPrice}
                  onChange={(ev) =>
                    updateItem(idx, { unitPrice: Number(ev.target.value) })
                  }
                />
              </div>
              <div className="flex items-center">
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label="Delete line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t pt-3 text-right text-sm">
          <div className="text-lg font-semibold">
            Total: {formatCurrency(total, currency)}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <Field name="notes" label="Notes / Remarks" error={e.notes}>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initial?.notes ?? ""}
          />
        </Field>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save" : "Issue Invoice"}
        </Button>
      </div>
    </form>
  );
}
