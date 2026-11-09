"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Paperclip, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PERMIT_TYPES } from "@/lib/permit-types";
import {
  permitsTotal,
  serializePermits,
  type PermitItem,
} from "@/lib/load-permits";

/**
 * Special permits bought for this load: which permit, its number and state,
 * what it cost, and the document. The cost comes out of the load total.
 *
 * Serialized into the hidden `permits` input; the server recomputes
 * `permitAmount` from the same items so the two can't disagree.
 */
export function PermitsField({
  items,
  onChange,
  currency = "USD",
  loadId,
  error,
}: {
  items: PermitItem[];
  onChange: (items: PermitItem[]) => void;
  currency?: string;
  /** Set when editing an existing load — files the document under Documents too. */
  loadId?: string;
  error?: string[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const targetIndex = useRef<number | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const total = permitsTotal(items);

  function update(index: number, patch: Partial<PermitItem>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function add() {
    onChange([
      ...items,
      {
        type: PERMIT_TYPES[0].value,
        permitNumber: null,
        jurisdiction: null,
        cost: 0,
        docUrl: null,
        docName: null,
      },
    ]);
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function pickFile(index: number) {
    targetIndex.current = index;
    fileRef.current?.click();
  }

  /** Stored value is a private storage key, which needs signing to be opened. */
  async function openDocument(docUrl: string) {
    if (/^(https?:)?\/\//.test(docUrl) || docUrl.startsWith("/")) {
      window.open(docUrl, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const res = await fetch(
        `/api/loads/accessorial-doc?key=${encodeURIComponent(docUrl)}`,
      );
      if (!res.ok) throw new Error("Could not open document");
      const { url } = await res.json();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open this document.");
    }
  }

  async function uploadFor(index: number, file: File) {
    setUploadingIndex(index);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "permit");
      if (loadId) fd.append("loadId", loadId);
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

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const index = targetIndex.current;
    e.target.value = "";
    targetIndex.current = null;
    if (!file || index == null) return;
    await uploadFor(index, file);
  }

  function handleDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFor(index, file);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    // Without preventDefault the browser opens the dropped file instead.
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverIndex(index);
  }

  function handleDragLeave(e: React.DragEvent) {
    // dragleave also fires when crossing into a child element — ignore those.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOverIndex(null);
  }

  return (
    <section className="grid gap-3 rounded-lg border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Permits</h3>
          <p className="text-xs text-muted-foreground">
            Special permits bought for this load. Their cost is taken out of the
            load total.
          </p>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Total permits: </span>
          <span className="font-mono font-semibold">
            {total.toLocaleString("en-US", {
              style: "currency",
              currency,
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      <input type="hidden" name="permits" value={serializePermits(items)} />
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
              key={i}
              onDragOver={(e) => handleDragOver(e, i)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, i)}
              className={`flex flex-wrap items-center gap-3 px-3 py-2 transition-colors ${
                dragOverIndex === i
                  ? "bg-primary/10 outline-dashed outline-2 -outline-offset-2 outline-primary"
                  : ""
              }`}
            >
              <Select
                value={item.type}
                className="h-8 w-40"
                onChange={(e) => update(i, { type: e.target.value })}
                aria-label="Permit type"
              >
                {PERMIT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>

              <Input
                className="h-8 w-36"
                placeholder="Permit #"
                value={item.permitNumber ?? ""}
                onChange={(e) => update(i, { permitNumber: e.target.value })}
              />

              <Input
                className="h-8 w-28"
                placeholder="State"
                value={item.jurisdiction ?? ""}
                onChange={(e) => update(i, { jurisdiction: e.target.value })}
              />

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-8 w-28"
                  value={item.cost || ""}
                  placeholder="0.00"
                  onChange={(e) =>
                    update(i, { cost: Number(e.target.value) || 0 })
                  }
                />
              </div>

              {item.docUrl ? (
                <span className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => openDocument(item.docUrl!)}
                    className="inline-flex max-w-[12rem] items-center gap-1 truncate text-primary hover:underline"
                    title={item.docName ?? "Document"}
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.docName ?? "Document"}</span>
                  </button>
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
                className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                title="Remove permit"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add permit
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error[0]}</p>}
    </section>
  );
}
