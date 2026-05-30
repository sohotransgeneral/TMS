"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditUserButton } from "./user-form-dialog";
import { deleteUser, toggleUserActive } from "@/actions/users";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  telegramChatId?: string | null;
  role: string;
  active: boolean;
  linkedCustomer?: { id: string; name: string } | null;
  customers?: Array<{
    id: string;
    name: string;
    email: string | null;
    userId?: string | null;
  }>;
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

export function UserRowActions({
  user,
  isSelf,
  trucks = [],
  trailers = [],
}: {
  user: UserRow;
  isSelf: boolean;
  trucks?: { id: string; label: string }[];
  trailers?: { id: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <EditUserButton user={user} trucks={trucks} trailers={trailers} />
      {!isSelf && (
        <>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm">
                {user.active ? "Deactivate" : "Activate"}
              </Button>
            }
            title={
              user.active
                ? "Dezactivezi utilizatorul?"
                : "Activezi utilizatorul?"
            }
            description={
              user.active
                ? "They will no longer be able to log in until reactivated."
                : "They will be able to log in again."
            }
            destructive={user.active}
            confirmLabel={user.active ? "Deactivate" : "Activate"}
            action={async () => toggleUserActive(user.id)}
          />
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" aria-label="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            }
            title="Delete user?"
            description="This action is irreversible."
            confirmLabel="Delete"
            action={async () => deleteUser(user.id)}
          />
        </>
      )}
    </div>
  );
}
