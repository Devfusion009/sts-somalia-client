"use client";

import { useActionState, useState } from "react";
import { UserPlus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import {
  adminAddHotelManager,
  adminRemoveHotelManager,
  adminUpdateHotelManagerPermissions,
} from "@/modules/admin/hotel-manager-actions";

type Manager = {
  id: string;
  can_manage_bookings: boolean;
  can_manage_photos: boolean;
  profile: { id: string; full_name: string | null; email: string | null } | null;
};

export function AddHotelManagerForm({ hotelId }: { hotelId: string }) {
  const [state, formAction] = useActionState(adminAddHotelManager, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="hotelId" value={hotelId} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="manager-email">Add a manager by email</Label>
          <Input id="manager-email" name="email" type="email" placeholder="Manager's email" required />
        </div>
        <SubmitButton pendingText="Adding…" className="gap-1.5">
          <UserPlus className="size-3.5" /> Add manager
        </SubmitButton>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox name="canManageBookings" /> Can manage bookings
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox name="canManagePhotos" /> Can upload photos
        </label>
      </div>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state && !state.error ? (
        state.newPassword ? (
          <div className="space-y-1 rounded-md border border-border bg-muted px-3 py-2">
            <p className="text-xs text-primary">Manager added — new account created. Share these credentials once:</p>
            <p className="font-mono text-sm select-all">{state.newPassword}</p>
          </div>
        ) : (
          <p className="text-xs text-primary">Manager added.</p>
        )
      ) : null}
    </form>
  );
}

function PermissionToggle({
  hotelId,
  manager,
  field,
  label,
}: {
  hotelId: string;
  manager: Manager;
  field: "canManageBookings" | "canManagePhotos";
  label: string;
}) {
  const [, formAction] = useActionState(adminUpdateHotelManagerPermissions, null);
  const granted = field === "canManageBookings" ? manager.can_manage_bookings : manager.can_manage_photos;

  return (
    <form action={formAction}>
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="managerId" value={manager.id} />
      <input
        type="hidden"
        name="canManageBookings"
        value={field === "canManageBookings" ? (granted ? "off" : "on") : manager.can_manage_bookings ? "on" : "off"}
      />
      <input
        type="hidden"
        name="canManagePhotos"
        value={field === "canManagePhotos" ? (granted ? "off" : "on") : manager.can_manage_photos ? "on" : "off"}
      />
      <button
        type="submit"
        className={cn(
          "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
          granted
            ? "border-transparent bg-primary/10 text-primary hover:bg-primary/15"
            : "border-border text-muted-foreground hover:bg-muted"
        )}
      >
        {label}
      </button>
    </form>
  );
}

export function HotelManagerRow({ hotelId, manager }: { hotelId: string; manager: Manager }) {
  const [state, formAction] = useActionState(adminRemoveHotelManager, null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setConfirmOpen(false);
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{manager.profile?.full_name ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{manager.profile?.email}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <PermissionToggle hotelId={hotelId} manager={manager} field="canManageBookings" label="Bookings" />
          <PermissionToggle hotelId={hotelId} manager={manager} field="canManagePhotos" label="Photos" />
        </div>
      </div>
      <Button
        size="icon"
        variant="outline"
        className="size-8 shrink-0 text-destructive hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
        aria-label="Remove manager"
      >
        <Trash2 className="size-3.5" />
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <form action={formAction}>
            <input type="hidden" name="hotelId" value={hotelId} />
            <input type="hidden" name="managerId" value={manager.id} />
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {manager.profile?.full_name ?? manager.profile?.email}?</AlertDialogTitle>
              <AlertDialogDescription>
                They immediately lose access to this hotel&apos;s rooms, inventory and bookings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {state?.error ? <p className="my-2 text-xs text-destructive">{state.error}</p> : null}
            <AlertDialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <SubmitButton variant="destructive" pendingText="Removing…">
                Remove manager
              </SubmitButton>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
