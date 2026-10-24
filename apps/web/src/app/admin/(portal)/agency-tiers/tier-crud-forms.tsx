"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/submit-button";
import {
  createAgencyTier,
  updateAgencyTier,
  deleteAgencyTier,
} from "@/modules/agencies/tier-actions";
import type { ActionState } from "@/lib/auth/actions";
import type { AgencyTier } from "@/modules/agencies/queries";
import { ConfirmButton } from "@/components/ui/confirm-button";

function TierFields({ tier }: { tier?: AgencyTier }) {
  const key = tier?.id ?? "new";
  return (
    <div className="grid gap-4 py-4 sm:grid-cols-2">
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor={`name-${key}`}>Name</FieldLabel>
        <Input id={`name-${key}`} name="name" defaultValue={tier?.name} placeholder="Gold" required />
      </Field>
      <Field>
        <FieldLabel htmlFor={`rate-${key}`}>Default commission</FieldLabel>
        <InputGroup className="max-sm:h-10">
          <InputGroupInput
            id={`rate-${key}`}
            name="defaultCommissionRate"
            type="number"
            step="0.5"
            min="0"
            max="100"
            defaultValue={tier?.default_commission_rate}
            required
            className="tabular-nums"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>%</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel htmlFor={`limit-${key}`}>Default credit limit</FieldLabel>
        <InputGroup className="max-sm:h-10">
          <InputGroupInput
            id={`limit-${key}`}
            name="defaultCreditLimit"
            type="number"
            step="50"
            min="0"
            defaultValue={tier?.default_credit_limit}
            required
            className="tabular-nums"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>USD</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </Field>
      <Field>
        <FieldLabel htmlFor={`sort-${key}`}>Sort order</FieldLabel>
        <Input
          id={`sort-${key}`}
          name="sortOrder"
          type="number"
          min="0"
          defaultValue={tier?.sort_order ?? 0}
          required
          className="tabular-nums"
        />
      </Field>
    </div>
  );
}

/**
 * Closes the dialog and refreshes the list once a save succeeds. The close is
 * applied during render (compare against the last state seen) rather than in
 * an effect, per react-hooks/set-state-in-effect.
 */
function useCloseOnSuccess(state: ActionState, setOpen: (open: boolean) => void) {
  const router = useRouter();
  const [seen, setSeen] = useState<ActionState>(null);

  if (state !== seen) {
    setSeen(state);
    if (state && !state.error) setOpen(false);
  }

  useEffect(() => {
    if (state && !state.error) router.refresh();
  }, [state, router]);
}

function TierDialogBody({
  title,
  tier,
  state,
  onCancel,
}: {
  title: string;
  tier?: AgencyTier;
  state: ActionState;
  onCancel: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      {tier ? <input type="hidden" name="tierId" value={tier.id} /> : null}
      <TierFields tier={tier} />
      {state?.error ? (
        <p role="alert" className="pb-4 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pendingText="Saving…">{tier ? "Save changes" : "Create tier"}</SubmitButton>
      </DialogFooter>
    </>
  );
}

export function CreateTierForm() {
  const [state, formAction] = useActionState(createAgencyTier, null);
  const [open, setOpen] = useState(false);
  useCloseOnSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus aria-hidden="true" /> New tier
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction}>
          <TierDialogBody title="New tier" state={state} onCancel={() => setOpen(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditTierForm({ tier }: { tier: AgencyTier }) {
  const [state, formAction] = useActionState(updateAgencyTier, null);
  const [open, setOpen] = useState(false);
  useCloseOnSuccess(state, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${tier.name}`} title="Edit" />}
      >
        <Pencil />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction}>
          <TierDialogBody title={tier.name} tier={tier} state={state} onCancel={() => setOpen(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTierForm({ tierId }: { tierId: string }) {
  const [state, formAction] = useActionState(deleteAgencyTier, null);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="tierId" value={tierId} />
      {state?.error ? (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
      <ConfirmButton
        title="Delete this tier?"
        aria-label="Delete tier"
        variant="ghost"
        size="icon-sm"
        className="text-destructive hover:text-destructive"
      >
        <Trash2 />
      </ConfirmButton>
    </form>
  );
}
