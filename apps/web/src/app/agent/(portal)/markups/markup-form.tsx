"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { upsertAgencyMarkup, type MarkupActionState } from "@/modules/agencies/markup-actions";

const VERTICALS = [
  { value: "all", label: "All services (default)" },
  { value: "hotel", label: "Hotels" },
  { value: "flight", label: "Flights" },
  { value: "visa", label: "Visa" },
  { value: "umrah", label: "Umrah" },
  { value: "hall", label: "Events & Halls" },
];

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * `pendingScopes` (item_type, or "all" for the default) lets the button say
 * what will actually happen: a scope that already has a request awaiting
 * approval gets that request replaced, not a second one queued.
 */
export function MarkupForm({ pendingScopes }: { pendingScopes: string[] }) {
  const [state, formAction] = useActionState<MarkupActionState, FormData>(upsertAgencyMarkup, null);
  const [itemType, setItemType] = useState("all");
  const replacesPending = pendingScopes.includes(itemType);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : state?.message ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="itemType">Applies to</Label>
          <select
            id="itemType"
            name="itemType"
            value={itemType}
            onChange={(e) => setItemType(e.target.value)}
            className={selectClass}
          >
            {VERTICALS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
                {pendingScopes.includes(v.value) ? " — pending" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="markupType">Type</Label>
          <select id="markupType" name="markupType" defaultValue="percent" className={selectClass}>
            <option value="percent">Percent (%)</option>
            <option value="fixed">Fixed amount (USD)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="value">Value</Label>
          <Input id="value" name="value" type="number" step="0.01" min="0" placeholder="5" required />
        </div>
      </div>

      <SubmitButton pendingText="Submitting…" variant={replacesPending ? "outline" : "default"}>
        {replacesPending ? "Replace pending request" : "Submit for approval"}
      </SubmitButton>
    </form>
  );
}
