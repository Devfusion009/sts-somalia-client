"use client";

import { useActionState, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { documentSlotsToRows } from "@/modules/admin/visa-type-utils";
import { DocumentSlotsField } from "./document-slots-field";
import {
  createVisaNationalityRule,
  updateVisaNationalityRule,
  deleteVisaNationalityRule,
} from "@/modules/admin/visa-nationality-rule-actions";
import type { Database } from "@/lib/types/database.types";

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
      <DialogTrigger
        render={
          rule ? (
            <Button size="sm" variant="ghost" className="gap-1">
              <Pencil className="size-3.5" /> Edit
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="size-3.5" /> Add nationality rule
            </Button>
          )
        }
      />
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
            <div className="space-y-1.5">
              <Label htmlFor="nationalityCode">Nationality</Label>
              <select
                id="nationalityCode"
                name="nationalityCode"
                required
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">Price override ({visaCurrency})</Label>
              <Input
                id="price"
                name="price"
                type="number"
                min={0}
                step="0.01"
                placeholder="Inherit default"
                defaultValue={rule?.price ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="processingFee">Processing fee override</Label>
              <Input
                id="processingFee"
                name="processingFee"
                type="number"
                min={0}
                step="0.01"
                placeholder="Inherit default"
                defaultValue={rule?.processing_fee ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="processingDaysMin">Processing days — min</Label>
              <Input
                id="processingDaysMin"
                name="processingDaysMin"
                type="number"
                min={0}
                placeholder="Inherit default"
                defaultValue={rule?.processing_days_min ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="processingDaysMax">Processing days — max</Label>
              <Input
                id="processingDaysMax"
                name="processingDaysMax"
                type="number"
                min={0}
                placeholder="Inherit default"
                defaultValue={rule?.processing_days_max ?? ""}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eligibilityRequirements">Eligibility override</Label>
            <Textarea
              id="eligibilityRequirements"
              name="eligibilityRequirements"
              rows={3}
              placeholder="Inherit default"
              defaultValue={rule?.eligibility_requirements ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Document override</Label>
            <DocumentSlotsField
              name="requiredDocuments"
              initialRows={rule?.required_documents ? documentSlotsToRows(rule.required_documents) : []}
            />
          </div>

          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
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
    <div className="space-y-3">
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No nationality overrides.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{countryName(rule.nationality_code)}</p>
                <p className="text-xs text-muted-foreground">
                  {[
                    rule.price !== null ? `${visaCurrency} ${Number(rule.price).toFixed(0)}` : null,
                    rule.processing_fee !== null ? `fee ${visaCurrency} ${Number(rule.processing_fee).toFixed(0)}` : null,
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
                  <Button size="sm" variant="ghost" type="submit" className="gap-1 text-destructive">
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
      <RuleDialog visaTypeId={visaTypeId} visaCurrency={visaCurrency} existingCodes={existingCodes} />
    </div>
  );
}
