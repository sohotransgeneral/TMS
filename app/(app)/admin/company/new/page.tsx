"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { createCompany } from "@/actions/company";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";

export default function NewCompanyPage() {
  const router = useRouter();
  const action = toActionState(createCompany);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Company created.");
      const id = (state.data as { id: string } | undefined)?.id;
      router.push(id ? `/admin/company/${id}` : "/admin/company");
    } else {
      toast.error(state.error ?? "Error");
    }
  }, [state, router]);

  const e = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Company"
        description="Create a new company and its admin account."
      />

      <form action={formAction} className="grid gap-6 max-w-2xl">
        {/* Company info */}
        <section className="grid gap-4 rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Company Details</h3>
          <Field name="name" label="Company Name" required error={e.name}>
            <Input
              id="name"
              name="name"
              required
              placeholder="Acme Transport SRL"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="taxId" label="Tax ID / CUI" error={e.taxId}>
              <Input id="taxId" name="taxId" />
            </Field>
            <Field
              name="registrationNumber"
              label="Reg. Number"
              error={e.registrationNumber}
            >
              <Input id="registrationNumber" name="registrationNumber" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="city" label="City" error={e.city}>
              <Input id="city" name="city" />
            </Field>
            <Field name="country" label="Country" error={e.country}>
              <Input id="country" name="country" placeholder="RO" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="currency" label="Currency" error={e.currency}>
              <Input id="currency" name="currency" defaultValue="USD" />
            </Field>
            <Field
              name="invoicePrefix"
              label="Invoice Prefix"
              error={e.invoicePrefix}
            >
              <Input
                id="invoicePrefix"
                name="invoicePrefix"
                placeholder="TMS"
              />
            </Field>
          </div>
        </section>

        {/* Admin account */}
        <section className="grid gap-4 rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Admin Account</h3>
          <Field
            name="adminName"
            label="Full Name"
            required
            error={e.adminName}
          >
            <Input
              id="adminName"
              name="adminName"
              required
              placeholder="John Smith"
            />
          </Field>
          <Field name="adminEmail" label="Email" required error={e.adminEmail}>
            <Input
              id="adminEmail"
              name="adminEmail"
              type="email"
              required
              placeholder="admin@company.com"
            />
          </Field>
          <Field
            name="adminPassword"
            label="Password"
            required
            error={e.adminPassword}
          >
            <Input
              id="adminPassword"
              name="adminPassword"
              type="password"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              At least 8 characters.
            </p>
          </Field>
        </section>

        <div className="flex gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create Company"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
