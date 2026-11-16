"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
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
import { trpc } from "@/lib/trpc/react";
import { TravelerFields } from "./traveler-fields";
import { PassportExpiryAlert, PassportExpiryBadge } from "./passport-alert";
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
  const router = useRouter();
  const utils = trpc.useUtils();

  const save = trpc.travelers.save.useMutation({
    onSuccess: () => {
      utils.travelers.myTravelers.invalidate();
      setEditing(null);
      toast.success("Traveler saved.");
      router.refresh();
    },
  });

  const remove = trpc.travelers.delete.useMutation({
    onSuccess: () => {
      utils.travelers.myTravelers.invalidate();
      setConfirmDelete(null);
      toast.success("Traveler removed.");
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  // async + awaited mutateAsync so SubmitButton's useFormStatus()-based
  // pending state tracks the mutation's actual duration — same pattern as
  // every prior phase's converted form.
  async function handleSubmit(formData: FormData) {
    try {
      await save.mutateAsync({
        travelerId: editing !== "new" ? editing?.id : undefined,
        fullName: formData.get("fullName") as string,
        relationship: formData.get("relationship") as never,
        dateOfBirth: (formData.get("dateOfBirth") as string) || undefined,
        gender: (formData.get("gender") as string) || undefined,
        nationality: (formData.get("nationality") as string) || undefined,
        passportNumber: (formData.get("passportNumber") as string) || undefined,
        passportIssueDate: (formData.get("passportIssueDate") as string) || undefined,
        passportExpiry: (formData.get("passportExpiry") as string) || undefined,
        notes: (formData.get("notes") as string) || undefined,
      });
    } catch {
      // handled via save.error below
    }
  }

  const companions = travelers.filter((t) => !t.is_self);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved travelers"
        status={companions.length > 0 ? <Badge variant="secondary">{companions.length}</Badge> : null}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus data-icon="inline-start" /> Add traveler
          </Button>
        }
      />

      {/* One alert per companion whose passport needs attention, above the
          list so the warnings are impossible to miss on a long page. */}
      {companions.map((traveler) => (
        <PassportExpiryAlert
          key={traveler.id}
          expiry={traveler.passport_expiry}
          subject={`${traveler.full_name}'s passport`}
        />
      ))}

      {companions.length === 0 ? (
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersRound />
              </EmptyMedia>
              <EmptyTitle>No saved travelers</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setEditing("new")}>
                <Plus data-icon="inline-start" /> Add traveler
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      ) : (
        <Card className="py-0">
          <ul className="divide-y divide-border">
            {companions.map((traveler) => (
              <li
                key={traveler.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-heading font-semibold">{traveler.full_name}</p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    <span className="capitalize">{traveler.relationship}</span>
                    {traveler.nationality
                      ? ` · ${countryFlag(traveler.nationality)} ${countryName(traveler.nationality)}`
                      : ""}
                    {traveler.passport_number ? (
                      <>
                        {" · "}
                        <span className="font-mono uppercase">{traveler.passport_number}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <PassportExpiryBadge expiry={traveler.passport_expiry} />
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit ${traveler.full_name}`}
                      onClick={() => setEditing(traveler)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Remove ${traveler.full_name}`}
                      onClick={() => setConfirmDelete(traveler)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? "Add traveler" : `Edit ${editing?.full_name ?? "traveler"}`}
            </DialogTitle>
          </DialogHeader>

          {/* Remounted per traveler so the uncontrolled defaultValue inputs
              actually reset when switching between people. Without the key,
              React reuses the same DOM nodes and the previous traveler's
              values stay on screen. */}
          <form
            key={editing === "new" ? "new" : (editing?.id ?? "none")}
            action={handleSubmit}
            className="space-y-4"
          >
            <TravelerFields
              traveler={editing === "new" ? null : editing}
              idPrefix={editing === "new" ? "new-traveler" : `traveler-${editing?.id}`}
              showRelationship
            />

            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-end">
              {save.error ? (
                <p role="alert" className="text-sm text-destructive sm:mr-auto">
                  {save.error.message}
                </p>
              ) : null}
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
              Their saved passport details are deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={remove.isPending}
              onClick={() => confirmDelete && remove.mutate({ travelerId: confirmDelete.id })}
            >
              Remove traveler
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
