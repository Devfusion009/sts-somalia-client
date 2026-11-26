"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { upsertAgencyMarkup, type MarkupActionState } from "@/modules/agencies/markup-actions";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

const VERTICALS = [
  { value: "all", label: "All services (default)" },
  { value: "hotel", label: "Hotels" },
  { value: "flight", label: "Flights" },
  { value: "visa", label: "Visa" },
  { value: "umrah", label: "Umrah" },
  { value: "hall", label: "Events & Halls" },
];

/**
 * `pendingScopes` (item_type, or "all" for the default) lets the button say
 * what will actually happen: a scope that already has a request awaiting
 * approval gets that request replaced, not a second one queued.
 */
export function MarkupForm({ pendingScopes }: { pendingScopes: string[] }) {
  const [state, formAction] = useActionState<MarkupActionState, FormData>(upsertAgencyMarkup, null);
  const [itemType, setItemType] = useState("all");
  const [markupType, setMarkupType] = useState("percent");
  const replacesPending = pendingScopes.includes(itemType);

  return (
    <form action={formAction}>
      <FieldGroup className="gap-4">
        {state?.message && !state.error ? (
          <Alert>
            <CheckCircle2 />
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <Field>
          <FieldLabel htmlFor="itemType">Applies to</FieldLabel>
          <select
            id="itemType"
            name="itemType"
            value={itemType}
            onChange={(e) => setItemType(e.target.value)}
            className={NATIVE_SELECT_CLASS}
          >
            {VERTICALS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
                {pendingScopes.includes(v.value) ? " — pending" : ""}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="markupType">Type</FieldLabel>
            <select id="markupType" name="markupType" value={markupType} onChange={(event) => setMarkupType(event.target.value)} className={NATIVE_SELECT_CLASS}>
              <option value="percent">Percent (%)</option>
              <option value="fixed">Fixed (USD)</option>
            </select>
          </Field>
          <Field data-invalid={state?.error ? true : undefined}>
            <FieldLabel htmlFor="value">{markupType === "percent" ? "Markup (%)" : "Markup (USD)"}</FieldLabel>
            <Input
              id="value"
              name="value"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="5"
              aria-invalid={state?.error ? true : undefined}
              required
              className="tabular-nums"
            />
          </Field>
        </div>

        <FieldError>{state?.error}</FieldError>
        <SubmitButton pendingText="Submitting…" variant={replacesPending ? "outline" : "default"} className="w-full">
          {replacesPending ? "Replace pending request" : "Submit for approval"}
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
