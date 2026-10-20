"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { saveUmrahOperations } from "@/modules/admin/site-settings/actions";
import { HAND_IN_LABEL, HAND_IN_TYPES } from "@/modules/umrah/readiness";
import type { UmrahOperations } from "@/modules/umrah/settings";

function NumberField({
  name,
  label,
  value,
  min,
  max,
}: {
  name: keyof UmrahOperations;
  label: string;
  value: number;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`umrah-${name}`}>{label}</Label>
      <Input id={`umrah-${name}`} name={name} type="number" min={min} max={max} defaultValue={value} required />
    </div>
  );
}

export function UmrahOperationsForm({ settings }: { settings: UmrahOperations }) {
  const [state, action] = useActionState(saveUmrahOperations, null);

  return (
    <Card>
      <CardContent className="p-5">
        <form action={action} className="space-y-5">
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField name="unpaidHoldHours" label="Unpaid seat hold (hours)" value={settings.unpaidHoldHours} min={0} max={720} />
            <NumberField
              name="privateDepositPercent"
              label="Private trip deposit (%)"
              value={settings.privateDepositPercent}
              min={0}
              max={100}
            />
            <NumberField
              name="privateBalanceDueDays"
              label="Private balance due (days before)"
              value={settings.privateBalanceDueDays}
              min={0}
              max={180}
            />
            <NumberField
              name="privateLeadDays"
              label="Private trip lead time (days)"
              value={settings.privateLeadDays}
              min={0}
              max={120}
            />
          </div>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="privateFullPaymentBeforeDocuments"
                defaultChecked={settings.privateFullPaymentBeforeDocuments}
                className="size-4"
              />
              Private trips: full payment before e-tickets and hotel vouchers
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="visaRequiresPassport"
                defaultChecked={settings.visaRequiresPassport}
                className="size-4"
              />
              Passport details required before visa processing
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Documents required before visa processing</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {HAND_IN_TYPES.map((type) => (
                <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="requiredDocuments"
                    value={type}
                    defaultChecked={settings.requiredDocuments.includes(type)}
                    className="size-4"
                  />
                  {HAND_IN_LABEL[type]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center gap-3 border-t pt-4">
            <SubmitButton size="sm" pendingText="Saving…">
              Save
            </SubmitButton>
            {state && !state.error ? (
              <span className="flex items-center gap-1.5 text-sm text-primary">
                <CheckCircle2 className="size-4" /> Saved.
              </span>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
