"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { useRestoreOnError } from "@/lib/use-restore-on-error";
import { updateUmrahPilgrim, type PilgrimActionState } from "@/modules/umrah/pilgrim-actions";
import { readinessLabel, type PilgrimReadiness } from "@/modules/umrah/readiness";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

export type EditablePilgrim = {
  id: string;
  full_name: string;
  gender: string;
  date_of_birth: string | null;
  nationality: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  passport_issue_country?: string | null;
  mahram_name: string | null;
  mahram_relation: string | null;
  phone?: string | null;
};

function formatDay(value: string | null) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function ReadinessBadges({ readiness }: { readiness?: PilgrimReadiness }) {
  if (!readiness) return null;
  if (readiness.missing.length === 0 && readiness.warnings.length === 0) {
    return <Badge variant="success">Ready</Badge>;
  }
  return (
    <>
      {readiness.missing.map((code) => (
        <Badge key={code} variant="destructive">
          {readinessLabel(code)}
        </Badge>
      ))}
      {readiness.warnings.map((code) => (
        <Badge key={code} variant="warning">
          {readinessLabel(code)}
        </Badge>
      ))}
    </>
  );
}

function PilgrimDialog({ pilgrim, open, onOpenChange }: { pilgrim: EditablePilgrim; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [state, formAction] = useActionState<PilgrimActionState, FormData>(updateUmrahPilgrim, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useRestoreOnError(formRef, state);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) onOpenChange(false);
  }
  useEffect(() => {
    if (state && !state.error) router.refresh();
  }, [state, router]);

  const id = (field: string) => `${field}-${pilgrim.id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{pilgrim.full_name}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="pilgrimId" value={pilgrim.id} />
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor={id("full_name")}>Full name (as in passport)</FieldLabel>
            <Input id={id("full_name")} name="full_name" defaultValue={pilgrim.full_name} maxLength={120} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor={id("gender")}>Gender</FieldLabel>
              <select id={id("gender")} name="gender" className={NATIVE_SELECT_CLASS} defaultValue={pilgrim.gender}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor={id("date_of_birth")}>Date of birth</FieldLabel>
              <Input id={id("date_of_birth")} name="date_of_birth" type="date" defaultValue={pilgrim.date_of_birth ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor={id("nationality")}>Nationality</FieldLabel>
              <Input id={id("nationality")} name="nationality" maxLength={60} defaultValue={pilgrim.nationality ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor={id("phone")}>Phone</FieldLabel>
              <Input id={id("phone")} name="phone" type="tel" maxLength={30} defaultValue={pilgrim.phone ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor={id("passport_number")}>Passport number</FieldLabel>
              <Input
                id={id("passport_number")}
                name="passport_number"
                maxLength={20}
                className="font-mono uppercase"
                defaultValue={pilgrim.passport_number ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={id("passport_expiry")}>Passport expiry</FieldLabel>
              <Input id={id("passport_expiry")} name="passport_expiry" type="date" defaultValue={pilgrim.passport_expiry ?? ""} />
            </Field>
            <Field className="col-span-2">
              <FieldLabel htmlFor={id("passport_issue_country")}>Passport issued by</FieldLabel>
              <Input
                id={id("passport_issue_country")}
                name="passport_issue_country"
                maxLength={60}
                defaultValue={pilgrim.passport_issue_country ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={id("mahram_name")}>Mahram name</FieldLabel>
              <Input id={id("mahram_name")} name="mahram_name" maxLength={120} defaultValue={pilgrim.mahram_name ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor={id("mahram_relation")}>Relation to mahram</FieldLabel>
              <Input
                id={id("mahram_relation")}
                name="mahram_relation"
                maxLength={60}
                defaultValue={pilgrim.mahram_relation ?? ""}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pilgrim rows with readiness badges and an edit dialog. `editable` is the
 * page's view of the lock; update_umrah_pilgrim enforces it either way.
 * `variant="table"` is the admin layout (every field visible).
 */
export function PilgrimEditor({
  pilgrims,
  readiness,
  editable,
  variant = "list",
}: {
  pilgrims: EditablePilgrim[];
  readiness: Record<string, PilgrimReadiness>;
  editable: boolean;
  variant?: "list" | "table";
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const current = pilgrims.find((p) => p.id === editing) ?? null;

  return (
    <>
      <ul className="divide-y divide-border">
        {pilgrims.map((pilgrim) => (
          <li key={pilgrim.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{pilgrim.full_name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {[
                  pilgrim.gender.charAt(0).toUpperCase() + pilgrim.gender.slice(1),
                  formatDay(pilgrim.date_of_birth),
                  pilgrim.nationality,
                  pilgrim.passport_number,
                  pilgrim.passport_expiry ? `exp. ${formatDay(pilgrim.passport_expiry)}` : null,
                  variant === "table" && pilgrim.mahram_name
                    ? `Mahram ${pilgrim.mahram_name}${pilgrim.mahram_relation ? ` (${pilgrim.mahram_relation})` : ""}`
                    : null,
                  variant === "table" ? pilgrim.phone : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <ReadinessBadges readiness={readiness[pilgrim.id]} />
            </div>
            {editable ? (
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Edit ${pilgrim.full_name}`}
                title="Edit"
                onClick={() => setEditing(pilgrim.id)}
              >
                <Pencil />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {current ? (
        <PilgrimDialog
          key={current.id}
          pilgrim={current}
          open={editing === current.id}
          onOpenChange={(open) => setEditing(open ? current.id : null)}
        />
      ) : null}
    </>
  );
}
