"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { saveUmrahTripPilgrims, type PilgrimInput } from "@/modules/umrah/custom-actions";
import { useRestoreOnError } from "@/lib/use-restore-on-error";
import { Field, TripNotFoundRecovery } from "./builder-shared";

export function StepPilgrims({
  requestId,
  numPilgrims,
  saved,
  notes,
}: {
  requestId: string;
  numPilgrims: number;
  saved: PilgrimInput[];
  notes: string | null;
}) {
  const [state, formAction] = useActionState(saveUmrahTripPilgrims, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRestoreOnError(formRef, state);

  return (
    <form ref={formRef} action={formAction} className="space-y-8">
      <input type="hidden" name="requestId" value={requestId} />

      <div>
        <h2 className="font-heading text-xl font-bold">Traveller details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter each traveller&apos;s details exactly as they appear in their passport — this is what
          goes on the visa application. Only the name and gender are needed now; passport details
          can follow later if you don&apos;t have them to hand.
        </p>
      </div>

      <div className="space-y-4">
        {Array.from({ length: numPilgrims }).map((_, i) => {
          const p = saved[i];
          return (
            <div key={i} className="rounded-xl border border-border">
              <p className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-bold">
                <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-primary">
                  <User className="size-3.5" />
                </span>
                Traveller {i + 1}
                {i === 0 ? (
                  <Badge className="border-transparent bg-chart-3/10 text-[10px] text-chart-3">
                    Lead traveller
                  </Badge>
                ) : null}
              </p>
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                <Field
                  label="Full name (as in passport)"
                  htmlFor={`pilgrim_${i}_full_name`}
                  required
                  className="sm:col-span-2"
                >
                  <Input
                    id={`pilgrim_${i}_full_name`}
                    name={`pilgrim_${i}_full_name`}
                    defaultValue={p?.full_name ?? ""}
                    placeholder="Enter full name"
                    required
                  />
                </Field>
                <Field label="Gender" required>
                  <Select name={`pilgrim_${i}_gender`} defaultValue={p?.gender ?? "male"}>
                    <SelectTrigger id={`pilgrim_${i}_gender`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date of birth" htmlFor={`pilgrim_${i}_date_of_birth`}>
                  <Input
                    id={`pilgrim_${i}_date_of_birth`}
                    name={`pilgrim_${i}_date_of_birth`}
                    type="date"
                    defaultValue={p?.date_of_birth ?? ""}
                  />
                </Field>
                <Field label="Nationality" htmlFor={`pilgrim_${i}_nationality`}>
                  <Input
                    id={`pilgrim_${i}_nationality`}
                    name={`pilgrim_${i}_nationality`}
                    defaultValue={p?.nationality ?? ""}
                    placeholder="e.g. Somali"
                  />
                </Field>
                <Field label="Passport number" htmlFor={`pilgrim_${i}_passport_number`}>
                  <Input
                    id={`pilgrim_${i}_passport_number`}
                    name={`pilgrim_${i}_passport_number`}
                    defaultValue={p?.passport_number ?? ""}
                    placeholder="Enter passport number"
                  />
                </Field>
                <Field label="Passport expiry" htmlFor={`pilgrim_${i}_passport_expiry`}>
                  <Input
                    id={`pilgrim_${i}_passport_expiry`}
                    name={`pilgrim_${i}_passport_expiry`}
                    type="date"
                    defaultValue={p?.passport_expiry ?? ""}
                  />
                </Field>
                <Field
                  label="Mahram name (if applicable)"
                  htmlFor={`pilgrim_${i}_mahram_name`}
                  hint={i === 0 ? "Required for female pilgrims under Umrah regulations." : undefined}
                >
                  <Input
                    id={`pilgrim_${i}_mahram_name`}
                    name={`pilgrim_${i}_mahram_name`}
                    defaultValue={p?.mahram_name ?? ""}
                  />
                </Field>
                <Field label="Relation to mahram" htmlFor={`pilgrim_${i}_mahram_relation`}>
                  <Input
                    id={`pilgrim_${i}_mahram_relation`}
                    name={`pilgrim_${i}_mahram_relation`}
                    defaultValue={p?.mahram_relation ?? ""}
                  />
                </Field>
              </div>
            </div>
          );
        })}
      </div>

      <Field
        label="Anything else we should know?"
        htmlFor="notes"
        hint="Wheelchair access, dietary needs, room preferences, or dates that could flex."
      >
        <Textarea id="notes" name="notes" rows={3} defaultValue={notes ?? ""} placeholder="Optional" />
      </Field>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="space-y-2">
            <p>{state.error}</p>
            <TripNotFoundRecovery error={state.error} />
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <Button render={<Link href={`/umrah/private/${requestId}?step=2`} />} variant="ghost" className="gap-2">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <SubmitButton size="lg" pendingText="Saving…" className="gap-2">
          Continue to review <ArrowRight className="size-4" />
        </SubmitButton>
      </div>
    </form>
  );
}
