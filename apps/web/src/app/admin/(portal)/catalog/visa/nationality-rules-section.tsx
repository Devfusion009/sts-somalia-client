"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/submit-button";
import { countryName, COUNTRY_OPTIONS } from "@/lib/countries";
import { money } from "@/lib/money";
import { documentSlotsToRows } from "@/modules/admin/visa-type-utils";
import { DocumentSlotsField } from "./document-slots-field";
import {
  createVisaNationalityRule,
  updateVisaNationalityRule,
  deleteVisaNationalityRule,
} from "@/modules/admin/visa-nationality-rule-actions";
import type { Database } from "@/lib/types/database.types";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

type Rule = Database["public"]["Tables"]["visa_nationality_rules"]["Row"];

function RuleDialog({
  visaTypeId,
  visaCurrency,
  rule,
  existingCodes,
}: {
  visaTypeId: string;
  visaCurrency: string;
  rule?: Rule;
  /** Nationality codes already ruled — a create dialog can't reuse one. */
  existingCodes: string[];
}) {
  const [open, setOpen] = useState(false);
  const action = rule ? updateVisaNationalityRule : createVisaNationalityRule;
  const [state, formAction] = useActionState(action, null);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {rule ? (
        <DialogTrigger
          render={<Button size="icon" variant="ghost" aria-label={`Edit ${countryName(rule.nationality_code)} rule`} title="Edit" />}
        >
          <Pencil />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="outline" />}>
          <Plus aria-hidden="true" /> Add nationality rule
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? `Rule for ${countryName(rule.nationality_code)}` : "Add nationality rule"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="visaTypeId" value={visaTypeId} />
          {rule ? <input type="hidden" name="ruleId" value={rule.id} /> : null}

          {rule ? (
            <input type="hidden" name="nationalityCode" value={rule.nationality_code} />
          ) : (
            <Field>
              <FieldLabel htmlFor="nationalityCode">Nationality</FieldLabel>
              <select
                id="nationalityCode"
                name="nationalityCode"
                required
                className={NATIVE_SELECT_CLASS}
                defaultValue=""
              >
                <option value="" disabled>
                  Select nationality
                </option>
                {COUNTRY_OPTIONS.filter(([code]) => !existingCodes.includes(code)).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="price">Price override ({visaCurrency})</FieldLabel>
              <Input
                id="price"
                name="price"
                type="number"
                min={0}
                step="0.01"
                placeholder="Inherit default"
                defaultValue={rule?.price ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="processingFee">Processing fee override</FieldLabel>
              <Input
                id="processingFee"
                name="processingFee"
                type="number"
                min={0}
                step="0.01"
                placeholder="Inherit default"
                defaultValue={rule?.processing_fee ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="processingDaysMin">Min processing days</FieldLabel>
              <Input
                id="processingDaysMin"
                name="processingDaysMin"
                type="number"
                min={0}
                placeholder="Inherit default"
                defaultValue={rule?.processing_days_min ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="processingDaysMax">Max processing days</FieldLabel>
              <Input
                id="processingDaysMax"
                name="processingDaysMax"
                type="number"
                min={0}
                placeholder="Inherit default"
                defaultValue={rule?.processing_days_max ?? ""}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="eligibilityRequirements">Eligibility override</FieldLabel>
            <Textarea
              id="eligibilityRequirements"
              name="eligibilityRequirements"
              rows={3}
              placeholder="Inherit default"
              defaultValue={rule?.eligibility_requirements ?? ""}
            />
          </Field>

          <Field>
            <p className="text-sm font-medium">Document override</p>
            <DocumentSlotsField
              name="requiredDocuments"
              initialRows={rule?.required_documents ? documentSlotsToRows(rule.required_documents) : []}
            />
          </Field>

          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">Save rule</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NationalityRulesSection({
  visaTypeId,
  visaCurrency,
  rules,
}: {
  visaTypeId: string;
  visaCurrency: string;
  rules: Rule[];
}) {
  const existingCodes = rules.map((r) => r.nationality_code);

  return (
    <div className="space-y-4">
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No nationality overrides</p>
      ) : (
        <ul className="divide-y divide-border">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0">
              <div className="min-w-0">
                <p className="font-medium">{countryName(rule.nationality_code)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {[
                    rule.price !== null ? money(rule.price, visaCurrency) : null,
                    rule.processing_fee !== null ? `Fee ${money(rule.processing_fee, visaCurrency)}` : null,
                    rule.processing_days_min !== null ? `${rule.processing_days_min}–${rule.processing_days_max ?? rule.processing_days_min}d` : null,
                    Array.isArray(rule.required_documents) && rule.required_documents.length > 0
                      ? `${rule.required_documents.length} custom doc(s)`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No overrides set"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <RuleDialog visaTypeId={visaTypeId} visaCurrency={visaCurrency} rule={rule} existingCodes={existingCodes} />
                <form action={deleteVisaNationalityRule}>
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <input type="hidden" name="visaTypeId" value={visaTypeId} />
                  <ConfirmButton
                    title="Delete this nationality rule?"
                    aria-label={`Delete ${countryName(rule.nationality_code)} rule`}
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <RuleDialog visaTypeId={visaTypeId} visaCurrency={visaCurrency} existingCodes={existingCodes} />
    </div>
  );
}
