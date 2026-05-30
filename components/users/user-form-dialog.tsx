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
import { Textarea } from "@/components/ui/textarea";
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
  driverProfile?: {
    id: string;
    firstName: string;
    lastName: string;
    cnp: string | null;
    licenseNumber: string | null;
    licenseCategories: string[];
    licenseIssuedAt: Date | string | null;
    licenseExpiresAt: Date | string | null;
    tachoCardNumber: string | null;
    tachoCardExpiresAt: Date | string | null;
    status: string;
    salaryType: string | null;
    salaryPerKm: number | null;
    salaryFixedAmount: number | null;
    grossPercent: number | null;
    commissionRate: number | null;
    taxCas: number | null;
    taxCass: number | null;
    taxImpozit: number | null;
    internalNotes: string | null;
    truckId?: string | null;
    trailerId?: string | null;
  } | null;
};

type CompanyOpt = { id: string; name: string };
type CustomerOpt = {
  id: string;
  name: string;
  email: string | null;
  userId?: string | null;
};

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

const DRIVER_STATUSES = [
  "AVAILABLE",
  "ON_TRIP",
  "OFF_DUTY",
  "UNAVAILABLE",
] as const;
const DRIVER_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  ON_TRIP: "On Trip",
  OFF_DUTY: "Off Duty",
  UNAVAILABLE: "Unavailable",
};

const ROLE_OPTIONS = (
  Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>
).filter((r) => r !== "SUPER_ADMIN");

interface UserFormDialogProps {
  initial?: UserRow;
  trigger: React.ReactNode;
  companies?: CompanyOpt[];
  customers?: CustomerOpt[];
  trucks?: { id: string; label: string }[];
  trailers?: { id: string; label: string }[];
}

export function UserFormDialog({
  initial,
  trigger,
  companies = [],
  customers = [],
  trucks = [],
  trailers = [],
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
      <DialogContent
        className={`max-h-[90vh] overflow-y-auto ${selectedRole === "DRIVER" ? "sm:max-w-2xl" : "sm:max-w-lg"}`}
      >
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
          {selectedRole === "DRIVER" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="firstName"
                label="First Name"
                required
                error={errors.firstName}
              >
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={initial?.driverProfile?.firstName ?? ""}
                  required
                />
              </Field>
              <Field
                name="lastName"
                label="Last Name"
                required
                error={errors.lastName}
              >
                <Input
                  id="lastName"
                  name="lastName"
                  defaultValue={initial?.driverProfile?.lastName ?? ""}
                  required
                />
              </Field>
            </div>
          ) : (
            <Field name="name" label="Full name" required error={errors.name}>
              <Input
                id="name"
                name="name"
                defaultValue={initial?.name ?? ""}
                required
              />
            </Field>
          )}
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
          {selectedRole === "DRIVER" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  name="licenseNumber"
                  label="License Number"
                  error={errors.licenseNumber}
                >
                  <Input
                    id="licenseNumber"
                    name="licenseNumber"
                    defaultValue={initial?.driverProfile?.licenseNumber ?? ""}
                  />
                </Field>
                <Field
                  name="licenseCategories"
                  label="Categories (B, C, CE…)"
                  error={errors.licenseCategories}
                >
                  <Input
                    id="licenseCategories"
                    name="licenseCategories"
                    defaultValue={(
                      initial?.driverProfile?.licenseCategories ?? []
                    ).join(",")}
                    placeholder="ex: B,C,CE"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  name="licenseIssuedAt"
                  label="License Issued"
                  error={errors.licenseIssuedAt}
                >
                  <Input
                    id="licenseIssuedAt"
                    name="licenseIssuedAt"
                    type="date"
                    defaultValue={toDateInput(
                      initial?.driverProfile?.licenseIssuedAt,
                    )}
                  />
                </Field>
                <Field
                  name="licenseExpiresAt"
                  label="License Expires"
                  error={errors.licenseExpiresAt}
                >
                  <Input
                    id="licenseExpiresAt"
                    name="licenseExpiresAt"
                    type="date"
                    defaultValue={toDateInput(
                      initial?.driverProfile?.licenseExpiresAt,
                    )}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  name="tachoCardNumber"
                  label="Tachograph Card"
                  error={errors.tachoCardNumber}
                >
                  <Input
                    id="tachoCardNumber"
                    name="tachoCardNumber"
                    defaultValue={initial?.driverProfile?.tachoCardNumber ?? ""}
                  />
                </Field>
                <Field
                  name="tachoCardExpiresAt"
                  label="Tachograph Expires"
                  error={errors.tachoCardExpiresAt}
                >
                  <Input
                    id="tachoCardExpiresAt"
                    name="tachoCardExpiresAt"
                    type="date"
                    defaultValue={toDateInput(
                      initial?.driverProfile?.tachoCardExpiresAt,
                    )}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  name="driverStatus"
                  label="Status"
                  error={errors.driverStatus}
                >
                  <Select
                    id="driverStatus"
                    name="driverStatus"
                    defaultValue={initial?.driverProfile?.status ?? "AVAILABLE"}
                  >
                    {DRIVER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {DRIVER_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field name="salaryType" label="Salary Type">
                  <Select
                    id="salaryType"
                    name="salaryType"
                    defaultValue={
                      initial?.driverProfile?.salaryType ?? "PER_MI"
                    }
                  >
                    <option value="PER_MI">Per Mile</option>
                    <option value="PERCENT_GROSS">% of Gross</option>
                    <option value="FIXED">Fixed Salary</option>
                  </Select>
                </Field>
                <Field
                  name="salaryPerKm"
                  label="Rate per mile"
                  error={errors.salaryPerKm}
                >
                  <Input
                    id="salaryPerKm"
                    name="salaryPerKm"
                    type="number"
                    step="0.001"
                    defaultValue={initial?.driverProfile?.salaryPerKm ?? ""}
                  />
                </Field>
                <Field
                  name="grossPercent"
                  label="% of Gross (e.g. 90)"
                  error={errors.grossPercent}
                >
                  <Input
                    id="grossPercent"
                    name="grossPercent"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    defaultValue={initial?.driverProfile?.grossPercent ?? ""}
                  />
                </Field>
                <Field
                  name="salaryFixedAmount"
                  label="Fixed amount per month"
                  error={errors.salaryFixedAmount}
                >
                  <Input
                    id="salaryFixedAmount"
                    name="salaryFixedAmount"
                    type="number"
                    step="1"
                    defaultValue={
                      initial?.driverProfile?.salaryFixedAmount ?? ""
                    }
                  />
                </Field>
                <Field
                  name="commissionRate"
                  label="Commission bonus (%)"
                  error={errors.commissionRate}
                >
                  <Input
                    id="commissionRate"
                    name="commissionRate"
                    type="number"
                    step="0.01"
                    defaultValue={initial?.driverProfile?.commissionRate ?? ""}
                  />
                </Field>
                <div className="col-span-full border-t pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Tax rates (%)
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <Field
                      name="taxCas"
                      label="CAS (pension)"
                      error={errors.taxCas}
                    >
                      <Input
                        id="taxCas"
                        name="taxCas"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="25"
                        defaultValue={initial?.driverProfile?.taxCas ?? ""}
                      />
                    </Field>
                    <Field
                      name="taxCass"
                      label="CASS (health)"
                      error={errors.taxCass}
                    >
                      <Input
                        id="taxCass"
                        name="taxCass"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="10"
                        defaultValue={initial?.driverProfile?.taxCass ?? ""}
                      />
                    </Field>
                    <Field
                      name="taxImpozit"
                      label="Income tax"
                      error={errors.taxImpozit}
                    >
                      <Input
                        id="taxImpozit"
                        name="taxImpozit"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="10"
                        defaultValue={initial?.driverProfile?.taxImpozit ?? ""}
                      />
                    </Field>
                  </div>
                </div>
              </div>
              <Field
                name="internalNotes"
                label="Internal notes"
                error={errors.internalNotes}
              >
                <Textarea
                  id="internalNotes"
                  name="internalNotes"
                  rows={3}
                  defaultValue={initial?.driverProfile?.internalNotes ?? ""}
                />
              </Field>

              {/* Vehicle assignment */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="driverTruckId" label="Assigned Truck">
                  <Select
                    id="driverTruckId"
                    name="driverTruckId"
                    defaultValue={initial?.driverProfile?.truckId ?? ""}
                  >
                    <option value="">— none —</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field name="driverTrailerId" label="Assigned Trailer">
                  <Select
                    id="driverTrailerId"
                    name="driverTrailerId"
                    defaultValue={initial?.driverProfile?.trailerId ?? ""}
                  >
                    <option value="">— none —</option>
                    {trailers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </>
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

export function EditUserButton({
  user,
  trucks = [],
  trailers = [],
}: {
  user: UserRow;
  trucks?: { id: string; label: string }[];
  trailers?: { id: string; label: string }[];
}) {
  return (
    <UserFormDialog
      initial={user}
      trucks={trucks}
      trailers={trailers}
      trigger={
        <Button variant="ghost" size="icon" aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
      }
    />
  );
}
