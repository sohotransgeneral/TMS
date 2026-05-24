"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
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
};

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
    if (state.ok) toast.success(state.message ?? "Salvat.");
    else toast.error(state.error);
  }, [state]);

  const e = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="grid gap-6">
      {companyId && <input type="hidden" name="id" value={companyId} />}
      <section className="grid gap-4 rounded-lg border bg-card p-6">
        <h3 className="font-semibold">Date generale</h3>
        <Field name="name" label="Denumire companie" required error={e.name}>
          <Input id="name" name="name" defaultValue={initial.name} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="taxId" label="CUI" error={e.taxId}>
            <Input id="taxId" name="taxId" defaultValue={initial.taxId ?? ""} />
          </Field>
          <Field name="regCom" label="Reg. comerțului" error={e.regCom}>
            <Input
              id="regCom"
              name="regCom"
              defaultValue={initial.regCom ?? ""}
            />
          </Field>
        </div>
        <Field name="address" label="Adresă" error={e.address}>
          <Input
            id="address"
            name="address"
            defaultValue={initial.address ?? ""}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="city" label="Oraș" error={e.city}>
            <Input id="city" name="city" defaultValue={initial.city ?? ""} />
          </Field>
          <Field name="country" label="Țară" error={e.country}>
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
        <h3 className="font-semibold">Bancă & facturare</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="bankName" label="Bancă" error={e.bankName}>
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
            label="Prefix factură"
            error={e.invoicePrefix}
          >
            <Input
              id="invoicePrefix"
              name="invoicePrefix"
              defaultValue={initial.invoicePrefix ?? "FCT"}
            />
          </Field>
          <Field name="currency" label="Monedă" error={e.currency}>
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
          <Field name="locale" label="Limbă" error={e.locale}>
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
          {pending ? "Se salvează…" : "Salvează modificările"}
        </Button>
      </div>
    </form>
  );
}
