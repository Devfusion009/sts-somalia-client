"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SubmitButton } from "@/components/submit-button";
import { countryFlag, countryName } from "@/lib/countries";
import { saveTravelerAction, deleteTravelerAction } from "../actions";
import { TravelerFields } from "./traveler-fields";
import { PassportExpiryBadge } from "./passport-alert";
import type { TravelerProfile } from "../queries";

/**
 * Saved companions — the people a customer books for repeatedly.
 *
 * The account holder's own record is excluded here and edited on the Profile
 * section instead, so there is exactly one place to change your own passport.
 */
export function TravelerManager({ travelers }: { travelers: TravelerProfile[] }) {
  const [editing, setEditing] = useState<TravelerProfile | null | "new">(null);
  const [confirmDelete, setConfirmDelete] = useState<TravelerProfile | null>(null);
  const [state, formAction] = useActionState(saveTravelerAction, null);

  // Close once the action succeeds. Derived during render rather than in an
  // effect, per this codebase's established pattern (see
  // src/app/affiliate/links/new-link-form.tsx): comparing against the
  // last-seen state avoids the cascading re-render an effect would cause.
  // A validation failure leaves the dialog open with its message visible.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setEditing(null);
  }

  const companions = travelers.filter((t) => !t.is_self);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {companions.length === 0
            ? "No saved travelers yet."
            : `${companions.length} saved traveler${companions.length === 1 ? "" : "s"}.`}
        </p>
        <Button onClick={() => setEditing("new")} className="gap-1.5">
          <Plus className="size-4" /> Add traveler
        </Button>
      </div>

      {companions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <UserRound className="size-5" />
            </span>
            <p className="font-medium">Save the people you travel with</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add a spouse, child or parent once and their passport details will prefill every visa
              application, Umrah booking and group ticket you make for them.
            </p>
            <Button onClick={() => setEditing("new")} className="mt-1 gap-1.5">
              <Plus className="size-4" /> Add your first traveler
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {companions.map((traveler) => (
            <Card key={traveler.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-heading font-bold">{traveler.full_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                      {traveler.relationship}
                      {traveler.nationality
                        ? ` · ${countryFlag(traveler.nationality)} ${countryName(traveler.nationality)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit ${traveler.full_name}`}
                      onClick={() => setEditing(traveler)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${traveler.full_name}`}
                      onClick={() => setConfirmDelete(traveler)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {traveler.passport_number ? (
                    <span className="font-mono uppercase">{traveler.passport_number}</span>
                  ) : null}
                  <PassportExpiryBadge expiry={traveler.passport_expiry} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? "Add a traveler" : `Edit ${editing?.full_name ?? "traveler"}`}
            </DialogTitle>
            <DialogDescription>
              Enter the details exactly as they appear in this person&apos;s passport — they are
              copied straight onto visa applications.
            </DialogDescription>
          </DialogHeader>

          {/* Remounted per traveler so the uncontrolled defaultValue inputs
              actually reset when switching between people. Without the key,
              React reuses the same DOM nodes and the previous traveler's
              values stay on screen. */}
          <form
            key={editing === "new" ? "new" : (editing?.id ?? "none")}
            action={formAction}
            className="space-y-4"
          >
            {editing && editing !== "new" ? (
              <input type="hidden" name="travelerId" value={editing.id} />
            ) : null}

            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <TravelerFields
              traveler={editing === "new" ? null : editing}
              idPrefix={editing === "new" ? "new-traveler" : `traveler-${editing?.id}`}
              showRelationship
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <SubmitButton pendingText="Saving…">
                {editing === "new" ? "Add traveler" : "Save changes"}
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmDelete?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their saved passport details will be deleted. Bookings and visa applications already
              made for them are unaffected — those keep their own copy of the details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <form action={deleteTravelerAction}>
              <input type="hidden" name="travelerId" value={confirmDelete?.id ?? ""} />
              <AlertDialogAction
                type="submit"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove traveler
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {state && !state.error ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Traveler saved.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
