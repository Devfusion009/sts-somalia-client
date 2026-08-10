"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  assignAgencyTier,
  applyTierDefaults,
  updateLowBalanceThreshold,
} from "@/modules/agencies/tier-actions";
import type { ActionState } from "@/lib/auth/actions";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function FormStatus({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-sm text-primary">
      <CheckCircle2 className="size-4" /> Saved.
    </p>
  );
}

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
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="agencyId" value={agencyId} />
        <div className="space-y-1.5">
          <Label htmlFor="tierId">Tier</Label>
          <select
            id="tierId"
            name="tierId"
            defaultValue={currentTierId ?? "none"}
            className={selectClass}
          >
            <option value="none">No tier</option>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name} ({tier.default_commission_rate}% · USD {tier.default_credit_limit})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            A labeled preset — assigning a tier doesn&apos;t change this agency&apos;s rate/limit
            by itself.
          </p>
        </div>
        <FormStatus state={state} />
        <SubmitButton size="sm" pendingText="Saving…">
          Assign tier
        </SubmitButton>
      </form>

      {currentTierId ? (
        <form action={applyAction} className="space-y-2 border-t border-border pt-3">
          <input type="hidden" name="agencyId" value={agencyId} />
          <p className="text-xs text-muted-foreground">
            Copy this tier&apos;s default commission rate and credit limit onto the agency.
          </p>
          <FormStatus state={applyState} />
          <Button type="submit" variant="outline" size="sm">
            Apply tier defaults
          </Button>
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
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="agencyId" value={agencyId} />
      <div className="space-y-1.5">
        <Label htmlFor="lowBalanceThreshold">Low-balance alert threshold (USD)</Label>
        <Input
          id="lowBalanceThreshold"
          name="lowBalanceThreshold"
          type="number"
          step="10"
          min="0"
          defaultValue={currentThreshold}
          required
        />
        <p className="text-xs text-muted-foreground">
          The agency&apos;s owner/admin are notified when available balance (wallet + credit
          limit) drops below this.
        </p>
      </div>
      <FormStatus state={state} />
      <SubmitButton size="sm" pendingText="Saving…">
        Update threshold
      </SubmitButton>
    </form>
  );
}
