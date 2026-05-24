"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DocumentList,
  type DocumentItem,
  type DocumentEntityLink,
} from "@/components/documents/document-list";

interface DocumentSectionProps {
  initialDocuments: DocumentItem[];
  entityLink: DocumentEntityLink;
  allowedTypes: string[];
}

export function DocumentSection({
  initialDocuments,
  entityLink,
  allowedTypes,
}: DocumentSectionProps) {
  const [docs, setDocs] = useState<DocumentItem[]>(initialDocuments);
  const [pending, start] = useTransition();

  async function refresh() {
    // Build query params from entityLink
    const params = new URLSearchParams();
    if (entityLink.loadId) params.set("loadId", entityLink.loadId);
    if (entityLink.truckId) params.set("truckId", entityLink.truckId);
    if (entityLink.trailerId) params.set("trailerId", entityLink.trailerId);
    if (entityLink.driverProfileId)
      params.set("driverProfileId", entityLink.driverProfileId);
    if (entityLink.customerId) params.set("customerId", entityLink.customerId);
    if (entityLink.invoiceId) params.set("invoiceId", entityLink.invoiceId);

    const res = await fetch(`/api/documents?${params.toString()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      setDocs(data.documents);
    }
  }

  function manualRefresh() {
    start(async () => {
      await refresh();
      toast.success("Document URLs refreshed.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={manualRefresh}
          disabled={pending}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${pending ? "animate-spin" : ""}`}
          />
          Refresh URLs
        </Button>
      </div>
      <DocumentList
        documents={docs}
        entityLink={entityLink}
        allowedTypes={allowedTypes}
        onRefresh={refresh}
      />
    </div>
  );
}
