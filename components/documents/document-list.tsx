"use client";

import { useState, useRef, useTransition } from "react";
import { toast } from "sonner";
import {
  FileText,
  Image as ImageIcon,
  Trash2,
  Upload,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DocumentItem = {
  id: string;
  type: string;
  name: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  expiresAt: Date | string | null;
  createdAt: Date | string;
  uploadedBy?: { name: string | null } | null;
};

export type DocumentEntityLink = {
  loadId?: string;
  truckId?: string;
  trailerId?: string;
  driverProfileId?: string;
  customerId?: string;
  invoiceId?: string;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  CMR: "CMR",
  BOL: "Bill of Lading",
  POD: "Proof of Delivery",
  INVOICE: "Invoice",
  DRIVER_LICENSE: "Driver License",
  ID_CARD: "ID Card",
  INSURANCE: "Insurance",
  ITP: "ITP",
  VIGNETTE: "Vignette",
  TACHOGRAPH: "Tachograph",
  CONTRACT: "Contract",
  OTHER: "Other",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

function DocIcon({ mimeType }: { mimeType: string | null }) {
  return mimeType && isImage(mimeType) ? (
    <ImageIcon className="h-5 w-5 text-blue-500" />
  ) : (
    <FileText className="h-5 w-5 text-red-500" />
  );
}

interface DocumentListProps {
  documents: DocumentItem[];
  entityLink: DocumentEntityLink;
  allowedTypes: string[];
  /** Called after a successful upload or delete so the parent can refresh */
  onRefresh?: () => void;
  canUpload?: boolean;
  canDelete?: boolean;
}

export function DocumentList({
  documents,
  entityLink,
  allowedTypes,
  onRefresh,
  canUpload = true,
  canDelete = true,
}: DocumentListProps) {
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState(allowedTypes[0] ?? "OTHER");
  const [expiresAt, setExpiresAt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", selectedType);
      fd.append("name", file.name);
      if (expiresAt) fd.append("expiresAt", expiresAt);
      if (entityLink.loadId) fd.append("loadId", entityLink.loadId);
      if (entityLink.truckId) fd.append("truckId", entityLink.truckId);
      if (entityLink.trailerId) fd.append("trailerId", entityLink.trailerId);
      if (entityLink.driverProfileId)
        fd.append("driverProfileId", entityLink.driverProfileId);
      if (entityLink.customerId) fd.append("customerId", entityLink.customerId);
      if (entityLink.invoiceId) fd.append("invoiceId", entityLink.invoiceId);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }
      toast.success("Document uploaded successfully");
      setExpiresAt("");
      if (fileRef.current) fileRef.current.value = "";
      onRefresh?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload error");
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(docId: string, docName: string) {
    if (!confirm(`Delete document "${docName}"?`)) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/documents/${docId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed");
        toast.success("Document deleted");
        onRefresh?.();
      } catch {
        toast.error("Error deleting document");
      }
    });
  }

  const isExpiringSoon = (expiresAt: Date | string | null) => {
    if (!expiresAt) return false;
    const d = new Date(expiresAt);
    const diff = d.getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // 30 days
  };

  const isExpired = (expiresAt: Date | string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-4">
      {/* Upload panel */}
      {canUpload && (
        <div className="rounded-lg border-2 border-dashed border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Upload Document</span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1.5 block text-xs font-medium text-foreground/70">
                Document Type
              </label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full bg-muted text-foreground border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DOC_TYPE_LABELS[t] ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="mb-1.5 block text-xs font-medium text-foreground/70">
                Expiry Date <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground [color-scheme:light] dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="pb-0.5">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {uploading ? "Uploading..." : "Upload File"}
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Accepted: PDF, JPEG, PNG, WEBP, GIF, HEIC — max 20 MB
          </p>
        </div>
      )}

      {/* Document list */}
      {documents.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No documents uploaded
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {documents.map((doc) => {
            const expired = isExpired(doc.expiresAt);
            const expiringSoon = isExpiringSoon(doc.expiresAt);
            return (
              <li
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <DocIcon mimeType={doc.mimeType} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">
                      {doc.name}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                      {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                    </span>
                    {expired && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                        Expired
                      </span>
                    )}
                    {!expired && expiringSoon && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        Expiring Soon
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {doc.sizeBytes != null ? formatBytes(doc.sizeBytes) : "—"}
                    </span>
                    {doc.expiresAt && (
                      <span>
                        Expires:{" "}
                        {new Date(doc.expiresAt).toLocaleDateString("en-GB")}
                      </span>
                    )}
                    {doc.uploadedBy?.name && (
                      <span>Uploaded by: {doc.uploadedBy.name}</span>
                    )}
                    <span>
                      {new Date(doc.createdAt).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Open"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  {canDelete && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(doc.id, doc.name)}
                      className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
