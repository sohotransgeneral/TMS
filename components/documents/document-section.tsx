"use client";

import { useState } from "react";
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

    const res = await fetch(`/api/documents?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setDocs(data.documents);
    }
  }

  return (
    <DocumentList
      documents={docs}
      entityLink={entityLink}
      allowedTypes={allowedTypes}
      onRefresh={refresh}
    />
  );
}
