"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { useRestoreOnError } from "@/lib/use-restore-on-error";
import { updateUmrahPilgrim, type PilgrimActionState } from "@/modules/umrah/pilgrim-actions";
import { readinessLabel, type PilgrimReadiness } from "@/modules/umrah/readiness";

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

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function formatDay(value: string | null) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function ReadinessBadges({ readiness }: { readiness?: PilgrimReadiness }) {
  if (!readiness) return null;
  if (readiness.missing.length === 0 && readiness.warnings.length === 0) {
    return <Badge className="border-transparent bg-primary/10 text-primary">Ready</Badge>;
  }
  return (
    <>
      {readiness.missing.map((code) => (
        <Badge key={code} className="border-transparent bg-destructive/10 text-destructive">
          {readinessLabel(code)}
        </Badge>
      ))}
      {readiness.warnings.map((code) => (
        <Badge key={code} className="border-transparent bg-brand-gold/15 text-brand-gold">
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
          <div className="space-y-1.5">
            <Label htmlFor={id("full_name")}>Full name (as in passport)</Label>
            <Input id={id("full_name")} name="full_name" defaultValue={pilgrim.full_name} maxLength={120} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={id("gender")}>Gender</Label>
              <select id={id("gender")} name="gender" className={selectClass} defaultValue={pilgrim.gender}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("date_of_birth")}>Date of birth</Label>
              <Input id={id("date_of_birth")} name="date_of_birth" type="date" defaultValue={pilgrim.date_of_birth ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("nationality")}>Nationality</Label>
              <Input id={id("nationality")} name="nationality" maxLength={60} defaultValue={pilgrim.nationality ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("phone")}>Phone</Label>
              <Input id={id("phone")} name="phone" type="tel" maxLength={30} defaultValue={pilgrim.phone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("passport_number")}>Passport number</Label>
              <Input
                id={id("passport_number")}
                name="passport_number"
                maxLength={20}
                className="font-mono uppercase"
                defaultValue={pilgrim.passport_number ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("passport_expiry")}>Passport expiry</Label>
              <Input id={id("passport_expiry")} name="passport_expiry" type="date" defaultValue={pilgrim.passport_expiry ?? ""} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={id("passport_issue_country")}>Passport issued by</Label>
              <Input
                id={id("passport_issue_country")}
                name="passport_issue_country"
                maxLength={60}
                defaultValue={pilgrim.passport_issue_country ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("mahram_name")}>Mahram name</Label>
              <Input id={id("mahram_name")} name="mahram_name" maxLength={120} defaultValue={pilgrim.mahram_name ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("mahram_relation")}>Relation to mahram</Label>
              <Input
                id={id("mahram_relation")}
                name="mahram_relation"
                maxLength={60}
                defaultValue={pilgrim.mahram_relation ?? ""}
              />
            </div>
          </div>
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
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
              <p className="text-xs text-muted-foreground">
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
                variant="outline"
                className="size-8"
                aria-label={`Edit ${pilgrim.full_name}`}
                onClick={() => setEditing(pilgrim.id)}
              >
                <Pencil className="size-3.5" />
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
