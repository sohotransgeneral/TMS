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
  role: string;
  active: boolean;
};

type CompanyOpt = { id: string; name: string };
type CustomerOpt = { id: string; name: string; email: string | null };

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
  const editing = Boolean(initial);
  const action = toActionState(editing ? updateUser : createUser);
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Salvat.");
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
          <DialogTitle>
            {editing ? "Editează utilizator" : "Utilizator nou"}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Actualizează datele utilizatorului."
              : "Adaugă un membru nou în echipa companiei."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {editing && <input type="hidden" name="id" value={initial!.id} />}
          {companies.length > 0 && !editing && (
            <Field
              name="companyId"
              label="Companie"
              error={errors.companyId}
            >
              <Select id="companyId" name="companyId" defaultValue="">
                <option value="">— Selectează compania —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field name="name" label="Nume complet" required error={errors.name}>
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
            <Field name="phone" label="Telefon" error={errors.phone}>
              <Input
                id="phone"
                name="phone"
                defaultValue={initial?.phone ?? ""}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="role" label="Rol" required error={errors.role}>
              <Select
                id="role"
                name="role"
                defaultValue={initial?.role ?? "DISPATCHER"}
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
                <option value="true">Activ</option>
                <option value="false">Inactiv</option>
              </Select>
            </Field>
          </div>
          {!editing && selectedRole === "CUSTOMER" && customers.length > 0 && (
            <Field
              name="customerId"
              label="Asociază client existent"
              error={errors.customerId}
            >
              <Select id="customerId" name="customerId" defaultValue="">
                <option value="">— Selectează clientul —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.email ? ` (${c.email})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field
            name="password"
            label={editing ? "Parolă nouă (opțional)" : "Parolă"}
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
                editing ? "Lasă gol pentru a păstra" : "Minim 8 caractere"
              }
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Anulează
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Se salvează…" : "Salvează"}
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
          <Plus className="h-4 w-4" /> Utilizator nou
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
        <Button variant="ghost" size="icon" aria-label="Editează">
          <Pencil className="h-4 w-4" />
        </Button>
      }
    />
  );
}
