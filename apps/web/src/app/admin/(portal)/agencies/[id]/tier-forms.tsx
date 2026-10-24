"use client";

import { useActionState } from "react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { SubmitButton } from "@/components/submit-button";
import {
  assignAgencyTier,
  applyTierDefaults,
  updateLowBalanceThreshold,
} from "@/modules/agencies/tier-actions";
import { FormFooter, selectClass } from "./form-footer";

export function AssignTierForm({
  agencyId,
  currentTierId,
  tiers,
}: {
  agencyId: string;
  currentTierId: string | null;
  tiers: { id: string; name: string; default_commission_rate: number; default_credit_limit: number }[];
}) {
  const [state, formAction] = useActionState(assignAgencyTier, null);
  const [applyState, applyAction] = useActionState(applyTierDefaults, null);

  return (
    <div className="space-y-4">
      <form action={formAction}>
        <FieldGroup className="gap-4">
          <input type="hidden" name="agencyId" value={agencyId} />
          <Field>
            <FieldLabel htmlFor="tierId">Tier</FieldLabel>
            <select id="tierId" name="tierId" defaultValue={currentTierId ?? "none"} className={selectClass}>
              <option value="none">No tier</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name} · {tier.default_commission_rate}% · USD{" "}
                  {tier.default_credit_limit.toLocaleString("en-US")}
                </option>
              ))}
            </select>
          </Field>
          <FormFooter state={state}>
            <SubmitButton size="sm" pendingText="Saving…">
              Assign tier
            </SubmitButton>
          </FormFooter>
        </FieldGroup>
      </form>

      {currentTierId ? (
        <form action={applyAction} className="border-t border-border pt-4">
          <input type="hidden" name="agencyId" value={agencyId} />
          <FormFooter state={applyState}>
            <SubmitButton variant="outline" size="sm" pendingText="Applying…">
              Apply tier defaults
            </SubmitButton>
          </FormFooter>
        </form>
      ) : null}
    </div>
  );
}

export function LowBalanceThresholdForm({
  agencyId,
  currentThreshold,
}: {
  agencyId: string;
  currentThreshold: number;
}) {
  const [state, formAction] = useActionState(updateLowBalanceThreshold, null);
  return (
    <form action={formAction}>
      <FieldGroup className="gap-4">
        <input type="hidden" name="agencyId" value={agencyId} />
        <Field>
          <FieldLabel htmlFor="lowBalanceThreshold">Alert below</FieldLabel>
          <InputGroup className="max-sm:h-10">
            <InputGroupInput
              id="lowBalanceThreshold"
              name="lowBalanceThreshold"
              type="number"
              step="10"
              min="0"
              defaultValue={currentThreshold}
              required
              className="tabular-nums"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>USD</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <FormFooter state={state}>
          <SubmitButton size="sm" pendingText="Saving…">
            Update threshold
          </SubmitButton>
        </FormFooter>
      </FieldGroup>
    </form>
  );
}
