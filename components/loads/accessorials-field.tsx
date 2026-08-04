"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Paperclip, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ACCESSORIAL_TYPES,
  accessorialsTotal,
  serializeAccessorials,
  type AccessorialItem,
} from "@/lib/accessorials";

/**
 * Accessorial line items on a load: what the extra charge is, how much it is,
 * and the document that proves it (lumper receipt, detention log, scale ticket).
 *
 * Serialized into the hidden `accessorials` input; the server recomputes
 * `accessorialAmount` from the same items so the two can't disagree.
 */
export function AccessorialsField({
  items,
  onChange,
  currency = "USD",
  error,
}: {
  items: AccessorialItem[];
  onChange: (items: AccessorialItem[]) => void;
  currency?: string;
  error?: string[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const targetIndex = useRef<number | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const used = new Set(items.map((i) => i.name));
  const available = ACCESSORIAL_TYPES.filter((t) => !used.has(t));
  const total = accessorialsTotal(items);

  function update(index: number, patch: Partial<AccessorialItem>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function add(name: string) {
    if (!name || used.has(name)) return;
    onChange([...items, { name, amount: 0, docUrl: null, docName: null }]);
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function pickFile(index: number) {
    targetIndex.current = index;
    fileRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const index = targetIndex.current;
    e.target.value = "";
    targetIndex.current = null;
    if (!file || index == null) return;

    setUploadingIndex(index);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/loads/accessorial-doc", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Upload failed");
      update(index, { docUrl: json.url, docName: json.name ?? file.name });
      toast.success("Document attached.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingIndex(null);
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Accessorials</h3>
          <p className="text-xs text-muted-foreground">
            Add each extra charge and attach the document that justifies it.
          </p>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Total accessorials: </span>
          <span className="font-mono font-semibold">
            {total.toLocaleString("en-US", {
              style: "currency",
              currency,
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      <input type="hidden" name="accessorials" value={serializeAccessorials(items)} />
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
        className="hidden"
        onChange={handleFile}
      />

      {items.length > 0 && (
        <ul className="divide-y rounded-md border">
          {items.map((item, i) => (
            <li
              key={item.name}
              className="flex flex-wrap items-center gap-3 px-3 py-2"
            >
              <span className="min-w-[10rem] flex-1 text-sm font-medium">
                {item.name}
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-8 w-28"
                  value={item.amount || ""}
                  placeholder="0.00"
                  onChange={(e) =>
                    update(i, { amount: Number(e.target.value) || 0 })
                  }
                />
              </div>

              {item.docUrl ? (
                <span className="flex items-center gap-1 text-xs">
                  <a
                    href={item.docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-[12rem] items-center gap-1 truncate text-primary hover:underline"
                    title={item.docName ?? "Document"}
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.docName ?? "Document"}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => update(i, { docUrl: null, docName: null })}
                    className="text-muted-foreground hover:text-destructive"
                    title="Remove document"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={uploadingIndex === i}
                  onClick={() => pickFile(i)}
                >
                  {uploadingIndex === i ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {uploadingIndex === i ? "Uploading…" : "Document"}
                </Button>
              )}

              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                title={`Remove ${item.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 text-muted-foreground" />
        <Select
          value=""
          className="max-w-xs"
          onChange={(e) => add(e.target.value)}
          disabled={available.length === 0}
          aria-label="Add accessorial"
        >
          <option value="">
            {available.length ? "Add accessorial…" : "All accessorials added"}
          </option>
          {available.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </section>
  );
}
