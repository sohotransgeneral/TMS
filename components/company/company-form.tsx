"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { Upload, X, Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import { updateMyCompany } from "@/actions/company";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";

export type CompanyData = {
  name: string;
  taxId: string | null;
  regCom: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bankName: string | null;
  bankAccount: string | null;
  invoicePrefix: string | null;
  currency: string;
  vatRate: number | null;
  timezone: string | null;
  locale: string | null;
  logoUrl?: string | null;
};

function LogoUpload({
  companyId,
  initial,
}: {
  companyId?: string;
  initial?: string | null;
}) {
  const router = useRouter();
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
      if (companyId) fd.append("companyId", companyId);
      const res = await fetch("/api/company/logo", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Upload failed");
      setUrl(json.url);
      toast.success("Logo uploaded successfully");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload error");
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      {/* Preview */}
      <div className="h-20 w-20 rounded-lg border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {url ? (
          <Image
            src={url}
            alt="Company logo"
            width={80}
            height={80}
            className="object-contain h-full w-full"
            unoptimized
          />
        ) : (
          <Building2 className="h-8 w-8 text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
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
            {url ? "Change Logo" : "Upload Logo"}
          </Button>
          {url && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setUrl("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, WEBP, SVG — max 5 MB
        </p>
      </div>

      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

export function CompanyForm({
  initial,
  companyId,
}: {
  initial: CompanyData;
  companyId?: string;
}) {
  const action = toActionState(updateMyCompany);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Saved.");
    else toast.error(state.error);
  }, [state]);

  const e = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="grid gap-6">
      {companyId && <input type="hidden" name="id" value={companyId} />}

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <h3 className="font-semibold">Company logo</h3>
        <LogoUpload companyId={companyId} initial={initial.logoUrl} />
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <h3 className="font-semibold">Date generale</h3>
        <Field name="name" label="Company name" required error={e.name}>
          <Input id="name" name="name" defaultValue={initial.name} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="taxId" label="CUI" error={e.taxId}>
            <Input id="taxId" name="taxId" defaultValue={initial.taxId ?? ""} />
          </Field>
          <Field name="regCom" label="Trade Register" error={e.regCom}>
            <Input
              id="regCom"
              name="regCom"
              defaultValue={initial.regCom ?? ""}
            />
          </Field>
        </div>
        <Field name="address" label="Address" error={e.address}>
          <Input
            id="address"
            name="address"
            defaultValue={initial.address ?? ""}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="city" label="City" error={e.city}>
            <Input id="city" name="city" defaultValue={initial.city ?? ""} />
          </Field>
          <Field name="country" label="Country" error={e.country}>
            <Input
              id="country"
              name="country"
              defaultValue={initial.country ?? "RO"}
            />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <h3 className="font-semibold">Contact</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="phone" label="Telefon" error={e.phone}>
            <Input id="phone" name="phone" defaultValue={initial.phone ?? ""} />
          </Field>
          <Field name="email" label="Email" error={e.email}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={initial.email ?? ""}
            />
          </Field>
          <Field name="website" label="Website" error={e.website}>
            <Input
              id="website"
              name="website"
              defaultValue={initial.website ?? ""}
            />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <h3 className="font-semibold">Bank & invoicing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="bankName" label="Bank" error={e.bankName}>
            <Input
              id="bankName"
              name="bankName"
              defaultValue={initial.bankName ?? ""}
            />
          </Field>
          <Field name="bankAccount" label="IBAN" error={e.bankAccount}>
            <Input
              id="bankAccount"
              name="bankAccount"
              defaultValue={initial.bankAccount ?? ""}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            name="invoicePrefix"
            label="Invoice prefix"
            error={e.invoicePrefix}
          >
            <Input
              id="invoicePrefix"
              name="invoicePrefix"
              defaultValue={initial.invoicePrefix ?? "FCT"}
            />
          </Field>
          <Field name="currency" label="Currency" error={e.currency}>
            <Input
              id="currency"
              name="currency"
              defaultValue={initial.currency}
            />
          </Field>
          <Field name="vatRate" label="TVA (%)" error={e.vatRate}>
            <Input
              id="vatRate"
              name="vatRate"
              type="number"
              step="0.01"
              defaultValue={initial.vatRate ?? 19}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="timezone" label="Fus orar" error={e.timezone}>
            <Input
              id="timezone"
              name="timezone"
              defaultValue={initial.timezone ?? "Europe/Bucharest"}
            />
          </Field>
          <Field name="locale" label="Language" error={e.locale}>
            <Input
              id="locale"
              name="locale"
              defaultValue={initial.locale ?? "ro-RO"}
            />
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
