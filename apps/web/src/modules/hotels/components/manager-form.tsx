"use client";

import { useActionState, useState } from "react";
import { UserPlus, Trash2, ChevronRight, ChevronDown, KeyRound, Copy, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/modules/hotels/manager-invite-actions";
import { MANAGER_PERMISSIONS } from "@/modules/hotels/manager-permissions";
import {
  addVenueManager,
  removeVenueManager,
  resetVenueManagerPassword,
  updateVenueManagerPermissions,
} from "@/modules/events/venue-manager-invite-actions";
import { VENUE_MANAGER_PERMISSIONS } from "@/modules/events/venue-manager-permissions";

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
  },
  venue: {
    idField: "venueId",
    permissions: VENUE_MANAGER_PERMISSIONS,
    add: addVenueManager,
    update: updateVenueManagerPermissions,
    remove: removeVenueManager,
    reset: resetVenueManagerPassword,
  },
} as const;

type ManagerKind = keyof typeof KINDS;

type Manager = {
  id: string;
  permissions: string[];
  profile: { id: string; full_name: string | null; email: string | null } | null;
};

function CredentialsOnce({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
      <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
        One-time password
      </Badge>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-sm select-all">{password}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={async () => {
            await navigator.clipboard.writeText(password);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function AddManagerForm({ kind, propertyId }: { kind: ManagerKind; propertyId: string }) {
  const config = KINDS[kind];
  const [state, formAction] = useActionState(config.add, null);
  return (
    <form action={formAction} className="space-y-3 border-t border-border pt-4">
      <input type="hidden" name={config.idField} value={propertyId} />
      <Label htmlFor="manager-email">Add a manager by email</Label>
      <div className="flex flex-wrap items-end gap-2">
        <Input id="manager-email" name="email" type="email" placeholder="Manager's email" className="min-w-56 flex-1" required />
        <SubmitButton pendingText="Adding…" className="gap-1.5">
          <UserPlus className="size-3.5" /> Add manager
        </SubmitButton>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {config.permissions.map((perm) => (
          <label key={perm.key} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox name="permissions" value={perm.key} /> {perm.label}
          </label>
        ))}
      </div>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state && !state.error ? (
        state.newPassword ? <CredentialsOnce password={state.newPassword} /> : <p className="text-xs text-primary">Manager added.</p>
      ) : null}
    </form>
  );
}

function PermissionToggle({
  kind,
  propertyId,
  manager,
  permKey,
  label,
}: {
  kind: ManagerKind;
  propertyId: string;
  manager: Manager;
  permKey: string;
  label: string;
}) {
  const [, formAction] = useActionState(KINDS[kind].update, null);
  const granted = manager.permissions.includes(permKey);
  const next = granted ? manager.permissions.filter((p) => p !== permKey) : [...manager.permissions, permKey];

  return (
    <form action={formAction}>
      <input type="hidden" name={KINDS[kind].idField} value={propertyId} />
      <input type="hidden" name="managerId" value={manager.id} />
      {next.map((p) => (
        <input key={p} type="hidden" name="permissions" value={p} />
      ))}
      <button
        type="submit"
        className={cn(
          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
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

function ResetPasswordControl({ kind, propertyId, managerId }: { kind: ManagerKind; propertyId: string; managerId: string }) {
  const [state, formAction] = useActionState(KINDS[kind].reset, null);
  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name={KINDS[kind].idField} value={propertyId} />
        <input type="hidden" name="managerId" value={managerId} />
        <SubmitButton variant="outline" size="sm" pendingText="Resetting…" className="gap-1.5">
          <KeyRound className="size-3.5" /> Reset password
        </SubmitButton>
      </form>
      {state?.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {state?.newPassword ? <CredentialsOnce password={state.newPassword} /> : null}
    </div>
  );
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
        className="flex w-full items-center justify-between gap-3 py-2.5 text-left first:pt-0 last:pb-0 hover:bg-muted/50"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{manager.profile?.full_name ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{manager.profile?.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {grantedCount === 0 ? "No permissions" : `${grantedCount} permission${grantedCount > 1 ? "s" : ""}`}
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
      </button>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{manager.profile?.full_name ?? manager.profile?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{manager.profile?.email}</p>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="flex flex-wrap gap-2">
                {config.permissions.map((perm) => (
                  <PermissionToggle
                    key={perm.key}
                    kind={kind}
                    propertyId={propertyId}
                    manager={manager}
                    permKey={perm.key}
                    label={perm.label}
                  />
                ))}
              </div>
            </div>
            <ResetPasswordControl kind={kind} propertyId={propertyId} managerId={manager.id} />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-3.5" /> Remove manager
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
          <Badge variant="secondary">{managers.length}</Badge>
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Add manager"
            onClick={() => setAdding((v) => !v)}
          >
            <UserPlus className="size-3.5" />
          </Button>
          {hasManagers ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {expanded ? "Hide" : "View"}
              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : null}
        </div>
      </div>

      {!hasManagers ? (
        <p className="text-sm text-muted-foreground">No managers assigned yet.</p>
      ) : expanded ? (
        <ul className="divide-y divide-border">
          {managers.map((manager) => (
            <li key={manager.id} className="py-2.5 first:pt-0 last:pb-0">
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
