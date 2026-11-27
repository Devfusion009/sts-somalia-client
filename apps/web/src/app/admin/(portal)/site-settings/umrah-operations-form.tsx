"use client";

import { useActionState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { SubmitButton } from "@/components/submit-button";
import { saveUmrahOperations } from "@/modules/admin/site-settings/actions";
import { HAND_IN_LABEL, HAND_IN_TYPES } from "@/modules/umrah/readiness";
import type { UmrahOperations } from "@/modules/umrah/settings";
import { SettingsFooter } from "./form-footer";

function NumberField({
  name,
  label,
  unit,
  value,
  min,
  max,
}: {
  name: keyof UmrahOperations;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={`umrah-${name}`}>{label}</FieldLabel>
      <InputGroup className="max-sm:h-10">
        <InputGroupInput
          id={`umrah-${name}`}
          name={name}
          type="number"
          min={min}
          max={max}
          defaultValue={value}
          required
          className="tabular-nums"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{unit}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}

export function UmrahOperationsForm({ settings }: { settings: UmrahOperations }) {
  const [state, action] = useActionState(saveUmrahOperations, null);

  return (
    <Card>
      <CardContent>
        <form action={action} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              name="unpaidHoldHours"
              label="Unpaid seat hold"
              unit="hours"
              value={settings.unpaidHoldHours}
              min={0}
              max={720}
            />
          </div>
          <div className="space-y-2.5">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="visaRequiresPassport"
                defaultChecked={settings.visaRequiresPassport}
                className="size-4 accent-primary"
              />
              Passport details required before visa processing
            </label>
          </div>
          <FieldSet className="gap-2.5">
            <FieldLegend variant="label">Documents required before visa processing</FieldLegend>
            <div className="flex flex-wrap gap-x-5 gap-y-2.5">
              {HAND_IN_TYPES.map((type) => (
                <label key={type} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    name="requiredDocuments"
                    value={type}
                    defaultChecked={settings.requiredDocuments.includes(type)}
                    className="size-4 accent-primary"
                  />
                  {HAND_IN_LABEL[type]}
                </label>
              ))}
            </div>
          </FieldSet>
          <SettingsFooter state={state}>
            <SubmitButton size="sm" pendingText="Saving…">
              Save
            </SubmitButton>
          </SettingsFooter>
        </form>
      </CardContent>
    </Card>
  );
}
