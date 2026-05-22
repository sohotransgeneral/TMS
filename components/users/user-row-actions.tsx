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
  role: string;
  active: boolean;
};

export function UserRowActions({
  user,
  isSelf,
}: {
  user: UserRow;
  isSelf: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <EditUserButton user={user} />
      {!isSelf && (
        <>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm">
                {user.active ? "Dezactivează" : "Activează"}
              </Button>
            }
            title={
              user.active
                ? "Dezactivezi utilizatorul?"
                : "Activezi utilizatorul?"
            }
            description={
              user.active
                ? "Nu va mai putea autentifica până la reactivare."
                : "Va putea autentifica din nou."
            }
            destructive={user.active}
            confirmLabel={user.active ? "Dezactivează" : "Activează"}
            action={async () => toggleUserActive(user.id)}
          />
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" aria-label="Șterge">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            }
            title="Ștergi utilizatorul?"
            description="Acțiunea este ireversibilă."
            confirmLabel="Șterge"
            action={async () => deleteUser(user.id)}
          />
        </>
      )}
    </div>
  );
}
