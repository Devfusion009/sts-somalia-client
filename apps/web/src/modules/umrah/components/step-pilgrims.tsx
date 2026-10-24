"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
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
  desk,
}: {
  requestId: string;
  numPilgrims: number;
  saved: PilgrimInput[];
  notes: string | null;
  /** True when this builder is hosted inside the agent portal — see
   *  wizardBasePath() in custom-actions.ts. */
  desk?: boolean;
}) {
  const basePath = desk ? "/agent/book/umrah/private" : "/umrah/private";
  const [state, formAction] = useActionState(saveUmrahTripPilgrims, null);
  const formRef = useRef<HTMLFormElement>(null);
  useRestoreOnError(formRef, state);

  return (
    <form ref={formRef} action={formAction} className="space-y-8">
      <input type="hidden" name="requestId" value={requestId} />
      {desk ? <input type="hidden" name="desk" value="1" /> : null}

      <h2 className="font-heading text-xl font-bold tracking-tight">Traveller details</h2>

      <div className="space-y-4">
        {Array.from({ length: numPilgrims }).map((_, i) => {
          const p = saved[i];
          return (
            <fieldset key={i} className="min-w-0 rounded-xl border border-border">
              <legend className="contents">
                <span className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5 text-sm font-semibold">
                  <span className="flex size-6 items-center justify-center rounded-full bg-card text-xs tabular-nums ring-1 ring-border">
                    {i + 1}
                  </span>
                  Traveller {i + 1}
                  {i === 0 ? <Badge variant="info">Lead traveller</Badge> : null}
                </span>
              </legend>
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
                <Field label="Gender" htmlFor={`pilgrim_${i}_gender`} required>
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
                >
                  <Input
                    id={`pilgrim_${i}_mahram_name`}
                    name={`pilgrim_${i}_mahram_name`}
                    defaultValue={p?.mahram_name ?? ""}
                    placeholder="Required for female pilgrims"
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
            </fieldset>
          );
        })}
      </div>

      <Field label="Special requests" htmlFor="notes">
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={notes ?? ""}
          placeholder="Wheelchair access, dietary needs, room preferences, flexible dates"
        />
      </Field>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="space-y-2">
            <p>{state.error}</p>
            <TripNotFoundRecovery error={state.error} basePath={basePath} />
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          render={<Link href={`${basePath}/${requestId}?step=2`} />}
          variant="ghost"
          size="lg"
          className="gap-2"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back
        </Button>
        <SubmitButton size="lg" pendingText="Saving…" className="gap-2">
          Continue to review <ArrowRight className="size-4" aria-hidden />
        </SubmitButton>
      </div>
    </form>
  );
}
