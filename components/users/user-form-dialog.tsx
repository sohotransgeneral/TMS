"use client";

import { useState, useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/forms/field";
import { createUser, updateUser } from "@/actions/users";
import { ROLE_LABELS } from "@/lib/permissions";
import { toActionState } from "@/lib/to-action-state";
import type { ActionResult } from "@/lib/action-helpers";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  telegramChatId?: string | null;
  role: string;
  active: boolean;
  linkedCustomer?: { id: string; name: string } | null;
  customers?: CustomerOpt[];
};

type CompanyOpt = { id: string; name: string };
type CustomerOpt = {
  id: string;
  name: string;
  email: string | null;
  userId?: string | null;
};

const ROLE_OPTIONS = (
  Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>
).filter((r) => r !== "SUPER_ADMIN");

interface UserFormDialogProps {
  initial?: UserRow;
  trigger: React.ReactNode;
  companies?: CompanyOpt[];
  customers?: CustomerOpt[];
}

export function UserFormDialog({
  initial,
  trigger,
  companies = [],
  customers = [],
}: UserFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(
    initial?.role ?? "DISPATCHER",
  );
  // Merge prop customers with initial's own customer list (for editing)
  const allCustomers: CustomerOpt[] = initial?.customers ?? customers;
  const editing = Boolean(initial);
  const action = toActionState(editing ? updateUser : createUser);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Saved.");
      setOpen(false);
    } else {
      toast.error(state.error);
    }
  }, [state]);

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit User" : "New User"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the user's details."
              : "Add a new member to your company's team."}
          </DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          className="grid gap-4"
          key={open ? "open" : "closed"}
        >
          {editing && <input type="hidden" name="id" value={initial!.id} />}
          {companies.length > 0 && !editing && (
            <Field name="companyId" label="Company" error={errors.companyId}>
              <Select id="companyId" name="companyId" defaultValue="">
                <option value="">— Select company —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field name="name" label="Full name" required error={errors.name}>
            <Input
              id="name"
              name="name"
              defaultValue={initial?.name ?? ""}
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="email" label="Email" required error={errors.email}>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={initial?.email ?? ""}
                required
              />
            </Field>
            <Field name="phone" label="Phone" error={errors.phone}>
              <Input
                id="phone"
                name="phone"
                defaultValue={initial?.phone ?? ""}
              />
            </Field>
          </div>
          <Field
            name="telegramChatId"
            label="Telegram chat id (optional)"
            error={errors.telegramChatId}
          >
            <Input
              id="telegramChatId"
              name="telegramChatId"
              defaultValue={initial?.telegramChatId ?? ""}
              placeholder="e.g. 123456789 — get yours from @userinfobot"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="role" label="Role" required error={errors.role}>
              <Select
                id="role"
                name="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field name="active" label="Status" error={errors.active}>
              <Select
                id="active"
                name="active"
                defaultValue={initial ? String(initial.active) : "true"}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </Field>
          </div>
          {selectedRole === "CUSTOMER" && (
            <Field
              name="customerId"
              label="Customer profile"
              error={errors.customerId}
            >
              <Select
                id="customerId"
                name="customerId"
                defaultValue={initial?.linkedCustomer?.id ?? ""}
              >
                <option value="">
                  {editing ? "— Unlink customer —" : "— Select customer —"}
                </option>
                {allCustomers.map((c) => {
                  const isLinkedToOther = c.userId && c.userId !== initial?.id;
                  return (
                    <option
                      key={c.id}
                      value={c.id}
                      disabled={isLinkedToOther === true}
                    >
                      {c.name}
                      {c.email ? ` (${c.email})` : ""}
                      {isLinkedToOther ? " — linked to another user" : ""}
                    </option>
                  );
                })}
              </Select>
              {initial?.linkedCustomer && (
                <p className="text-xs text-muted-foreground mt-1">
                  Currently linked:{" "}
                  <span className="font-medium">
                    {initial.linkedCustomer.name}
                  </span>
                </p>
              )}
            </Field>
          )}
          <Field
            name="password"
            label={editing ? "New password (optional)" : "Password"}
            required={!editing}
            error={errors.password}
          >
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required={!editing}
              placeholder={
                editing
                  ? "Leave blank to keep current"
                  : "At least 8 characters"
              }
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewUserButton({
  companies = [],
  customers = [],
}: {
  companies?: CompanyOpt[];
  customers?: CustomerOpt[];
}) {
  return (
    <UserFormDialog
      companies={companies}
      customers={customers}
      trigger={
        <Button>
          <Plus className="h-4 w-4" /> New User
        </Button>
      }
    />
  );
}

export function EditUserButton({ user }: { user: UserRow }) {
  return (
    <UserFormDialog
      initial={user}
      trigger={
        <Button variant="ghost" size="icon" aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      }
    />
  );
}
