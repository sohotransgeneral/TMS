"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { updateProfile, changePassword } from "@/actions/settings";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";

type ProfileData = {
  name: string | null;
  email: string;
  phone: string | null;
};

export function ProfileForm({ initial }: { initial: ProfileData }) {
  const action = toActionState(updateProfile);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Saved.");
    else toast.error(state.error ?? "Error");
  }, [state]);

  const e = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="grid gap-4">
      <Field name="name" label="Full Name" required error={e.name}>
        <Input
          id="name"
          name="name"
          defaultValue={initial.name ?? ""}
          required
        />
      </Field>
      <Field name="email" label="Email" required error={e.email}>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={initial.email}
          required
        />
      </Field>
      <Field name="phone" label="Phone" error={e.phone}>
        <Input id="phone" name="phone" defaultValue={initial.phone ?? ""} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save Profile"}
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const action = toActionState(changePassword);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Password changed.");
    else toast.error(state.error ?? "Error");
  }, [state]);

  const e = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="grid gap-4">
      <Field
        name="currentPassword"
        label="Current Password"
        required
        error={e.currentPassword}
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
        />
      </Field>
      <Field
        name="newPassword"
        label="New Password"
        required
        error={e.newPassword}
      >
        <Input id="newPassword" name="newPassword" type="password" required />
        <p className="text-xs text-muted-foreground mt-1">
          At least 8 characters.
        </p>
      </Field>
      <Field
        name="confirmPassword"
        label="Confirm New Password"
        required
        error={e.confirmPassword}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Change Password"}
        </Button>
      </div>
    </form>
  );
}
