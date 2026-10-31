"use client";

import { useActionState, useState } from "react";
import { UserPlus, Trash2, ChevronRight, Eye, EyeOff, KeyRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import {
  addHotelManager,
  removeHotelManager,
  resetHotelManagerPassword,
  updateHotelManagerPermissions,
  retryHotelManagerCredentialEmail,
} from "@/modules/hotels/manager-invite-actions";
import { MANAGER_PERMISSIONS } from "@/modules/hotels/manager-permissions";
import {
  addVenueManager,
  removeVenueManager,
  resetVenueManagerPassword,
  updateVenueManagerPermissions,
  retryVenueManagerCredentialEmail,
} from "@/modules/events/venue-manager-invite-actions";
import { VENUE_MANAGER_PERMISSIONS } from "@/modules/events/venue-manager-permissions";
import { ManagerPermissionControls } from "./manager-permission-controls";

/**
 * Hotels and venues share one assignment UI; each kind brings its own id
 * field, permission registry and server actions (which authorize the caller
 * in the database).
 */
const KINDS = {
  hotel: {
    idField: "hotelId",
    permissions: MANAGER_PERMISSIONS,
    add: addHotelManager,
    update: updateHotelManagerPermissions,
    remove: removeHotelManager,
    reset: resetHotelManagerPassword,
    retry: retryHotelManagerCredentialEmail,
  },
  venue: {
    idField: "venueId",
    permissions: VENUE_MANAGER_PERMISSIONS,
    add: addVenueManager,
    update: updateVenueManagerPermissions,
    remove: removeVenueManager,
    reset: resetVenueManagerPassword,
    retry: retryVenueManagerCredentialEmail,
  },
} as const;

type ManagerKind = keyof typeof KINDS;

type Manager = {
  id: string;
  permissions: string[];
  profile: { id: string; full_name: string | null; email: string | null; manager_code?: string | null; manager_contact_email?: string | null } | null;
};

function AddManagerForm({ kind, propertyId }: { kind: ManagerKind; propertyId: string }) {
  const config = KINDS[kind];
  const [state, formAction] = useActionState(config.add, null);
  return (
    <form action={formAction} className="space-y-3 border-t border-border pt-4">
      <input type="hidden" name={config.idField} value={propertyId} />
      <Field>
        <FieldLabel htmlFor={`${kind}-manager-email`}>Manager contact email</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={`${kind}-manager-email`}
            name="email"
            type="email"
            placeholder="name@example.com"
            className="min-w-0 flex-1 basis-56 max-sm:h-10"
            required
          />
          <SubmitButton pendingText="Adding…">
            <UserPlus aria-hidden="true" /> Add
          </SubmitButton>
        </div>
      </Field>

      <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
        <legend className="sr-only">Permissions</legend>
        {config.permissions.map((perm) => (
          <label key={perm.key} className="flex min-h-8 items-center gap-2 text-sm">
            <Checkbox name="permissions" value={perm.key} /> {perm.label}
          </label>
        ))}
      </fieldset>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state && !state.error ? <div role="status" className="space-y-1 text-xs">
        <div className="font-mono font-medium">{state.managerCode}</div>
        <div className={state.emailStatus === "sent" ? "text-primary" : "text-destructive"}>{state.emailStatus === "sent" ? "Manager added. Access email sent." : "Manager added. Access email not sent."}</div>
      </div> : null}
    </form>
  );
}

function ResetPasswordControl({ kind, propertyId, managerId }: { kind: ManagerKind; propertyId: string; managerId: string }) {
  const [state, formAction] = useActionState(KINDS[kind].reset, null);
  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name={KINDS[kind].idField} value={propertyId} />
        <input type="hidden" name="managerId" value={managerId} />
        <SubmitButton variant="outline" size="sm" pendingText="Sending…">
          <KeyRound aria-hidden="true" /> Send reset link
        </SubmitButton>
      </form>
      {state?.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
      {state && !state.error ? <div role="status" className="text-xs text-primary">Reset link sent.</div> : null}
    </div>
  );
}

function RetryCredentialEmail({ kind, propertyId, managerId }: { kind: ManagerKind; propertyId: string; managerId: string }) {
  const [state, action] = useActionState(KINDS[kind].retry, null);
  return <form action={action} className="space-y-2">
    <input type="hidden" name={KINDS[kind].idField} value={propertyId} /><input type="hidden" name="managerId" value={managerId} />
    <SubmitButton variant="outline" size="sm" pendingText="Sending…">Retry credential email</SubmitButton>
    {state ? <div role={state.error ? "alert" : "status"} className={cn("text-xs", state.error ? "text-destructive" : "text-primary")}>{state.error ?? "Credential email sent."}</div> : null}
  </form>;
}

/**
 * Collapsed to name/email/permission-count in the list; every detail (the
 * permission toggles, password reset, remove) lives behind one click in its
 * own dialog — replaces the previous always-expanded row, which put every
 * manager's full control surface on screen at once regardless of how many
 * there were.
 */
function ManagerRow({ kind, propertyId, manager }: { kind: ManagerKind; propertyId: string; manager: Manager }) {
  const config = KINDS[kind];
  const [detailOpen, setDetailOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, formAction] = useActionState(config.remove, null);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) {
      setConfirmOpen(false);
      setDetailOpen(false);
    }
  }

  const grantedCount = manager.permissions.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 py-2.5 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{manager.profile?.full_name ?? "—"}</p>
          {manager.profile?.manager_code ? <div className="mt-0.5 font-mono text-xs text-primary">{manager.profile.manager_code}</div> : null}
          <p className="truncate text-xs text-muted-foreground">{manager.profile?.manager_contact_email ?? manager.profile?.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {grantedCount === 0 ? "No permissions" : `${grantedCount} permission${grantedCount > 1 ? "s" : ""}`}
          </span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </button>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{manager.profile?.full_name ?? manager.profile?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {manager.profile?.manager_code ? <dl className="text-sm"><dt className="text-xs text-muted-foreground">Manager ID</dt><dd className="mt-1 font-mono font-semibold">{manager.profile.manager_code}</dd></dl> : null}
            {manager.profile?.full_name ? (
              <p className="truncate text-sm text-muted-foreground">{manager.profile.manager_contact_email ?? manager.profile.email}</p>
            ) : null}
            <ManagerPermissionControls
              action={config.update}
              propertyField={config.idField}
              propertyId={propertyId}
              managerId={manager.id}
              grantedPermissions={manager.permissions}
              permissions={config.permissions}
            />
            <RetryCredentialEmail kind={kind} propertyId={propertyId} managerId={manager.id} />
            <ResetPasswordControl kind={kind} propertyId={propertyId} managerId={manager.id} />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 aria-hidden="true" /> Remove manager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <form action={formAction}>
            <input type="hidden" name={config.idField} value={propertyId} />
            <input type="hidden" name="managerId" value={manager.id} />
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {manager.profile?.full_name ?? manager.profile?.email}?</AlertDialogTitle>
            </AlertDialogHeader>
            {state?.error ? (
              <p role="alert" className="my-2 text-xs text-destructive">
                {state.error}
              </p>
            ) : null}
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
    </>
  );
}

/**
 * Who has access to a hotel is sensitive enough on its own that it shouldn't
 * be readable at a glance every time this page loads — collapsed to a count
 * by default, the names/emails only render once the viewer deliberately asks
 * to see them. The add-manager action stays visible either way: it doesn't
 * expose anyone's identity, so gating it behind the same toggle would only
 * add a click to a normal task, not protect anything.
 *
 * Shared verbatim between the admin console and the hotel partner portal —
 * both render this same component against the same actions
 * (manager-invite-actions.ts), which authorize the caller (admin or the
 * hotel's owning partner) at the RPC layer rather than here.
 */
function ManagersSection({ kind, propertyId, managers }: { kind: ManagerKind; propertyId: string; managers: Manager[] }) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const hasManagers = managers.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <h2 className="font-heading text-sm font-semibold">Managers</h2>
          <Badge variant="neutral" className="tabular-nums">
            {managers.length}
          </Badge>
        </span>
        <div className="flex items-center gap-1">
          {hasManagers ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={expanded ? "Hide managers" : "Show managers"}
              aria-expanded={expanded}
              title={expanded ? "Hide" : "Show"}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <EyeOff /> : <Eye />}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={adding ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Add manager"
            aria-expanded={adding}
            title="Add manager"
            onClick={() => setAdding((v) => !v)}
          >
            <UserPlus />
          </Button>
        </div>
      </div>

      {!hasManagers ? (
        <p className="text-sm text-muted-foreground">No managers</p>
      ) : expanded ? (
        <ul className="divide-y divide-border">
          {managers.map((manager) => (
            <li key={manager.id} className="py-0.5">
              <ManagerRow kind={kind} propertyId={propertyId} manager={manager} />
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? <AddManagerForm kind={kind} propertyId={propertyId} /> : null}
    </div>
  );
}

export function HotelManagersSection({ hotelId, managers }: { hotelId: string; managers: Manager[] }) {
  return <ManagersSection kind="hotel" propertyId={hotelId} managers={managers} />;
}

export function VenueManagersSection({ venueId, managers }: { venueId: string; managers: Manager[] }) {
  return <ManagersSection kind="venue" propertyId={venueId} managers={managers} />;
}
