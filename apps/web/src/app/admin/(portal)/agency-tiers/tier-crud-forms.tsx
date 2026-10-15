"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Pencil, Trash2, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import {
  createAgencyTier,
  updateAgencyTier,
  deleteAgencyTier,
} from "@/modules/agencies/tier-actions";
import type { ActionState } from "@/lib/auth/actions";
import type { AgencyTier } from "@/modules/agencies/queries";
import { ConfirmButton } from "@/components/ui/confirm-button";

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

function TierFields({ tier }: { tier?: AgencyTier }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="col-span-2 space-y-1.5 sm:col-span-1">
        <Label htmlFor={`name-${tier?.id ?? "new"}`}>Name</Label>
        <Input id={`name-${tier?.id ?? "new"}`} name="name" defaultValue={tier?.name} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`rate-${tier?.id ?? "new"}`}>Commission %</Label>
        <Input
          id={`rate-${tier?.id ?? "new"}`}
          name="defaultCommissionRate"
          type="number"
          step="0.5"
          min="0"
          max="100"
          defaultValue={tier?.default_commission_rate}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`limit-${tier?.id ?? "new"}`}>Credit limit (USD)</Label>
        <Input
          id={`limit-${tier?.id ?? "new"}`}
          name="defaultCreditLimit"
          type="number"
          step="50"
          min="0"
          defaultValue={tier?.default_credit_limit}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`sort-${tier?.id ?? "new"}`}>Sort order</Label>
        <Input
          id={`sort-${tier?.id ?? "new"}`}
          name="sortOrder"
          type="number"
          min="0"
          defaultValue={tier?.sort_order ?? 0}
          required
        />
      </div>
    </div>
  );
}

export function CreateTierForm() {
  const [state, formAction] = useActionState(createAgencyTier, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" /> New tier
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <TierFields />
      <FormStatus state={state} />
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Creating…">
          Create tier
        </SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function EditTierForm({ tier }: { tier: AgencyTier }) {
  const [state, formAction] = useActionState(updateAgencyTier, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="ghost" size="icon" className="size-8" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
      </Button>
    );
  }

  return (
    <form action={formAction} className="col-span-full space-y-3 rounded-lg border border-border p-4">
      <input type="hidden" name="tierId" value={tier.id} />
      <TierFields tier={tier} />
      <FormStatus state={state} />
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Saving…">
          Save changes
        </SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function DeleteTierForm({ tierId }: { tierId: string }) {
  const [state, formAction] = useActionState(deleteAgencyTier, null);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="tierId" value={tierId} />
      {state?.error ? (
        <Alert variant="destructive" className="mb-2">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <ConfirmButton
        title="Delete this tier?"
        aria-label="Delete tier"
        variant="ghost"
        size="icon"
        className="size-8 text-destructive hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
      </ConfirmButton>
    </form>
  );
}
