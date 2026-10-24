"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { SubmitButton } from "@/components/submit-button";
import {
  updateAgencyCommissionRate,
  updateAgencyCreditLimit,
  adminApplyWalletTransaction,
  recordAgencyCommissionPayout,
  updateAgencyAllowedProducts,
  issueAgencyNoteAction,
} from "@/modules/agencies/admin-actions";
import { cn } from "@/lib/utils";
import { FormFooter, selectClass } from "./form-footer";

function Addon({ children }: { children: string }) {
  return (
    <InputGroupAddon align="inline-end">
      <InputGroupText>{children}</InputGroupText>
    </InputGroupAddon>
  );
}

export function CommissionRateForm({
  agencyId,
  currentRate,
}: {
  agencyId: string;
  currentRate: number;
}) {
  const [state, formAction] = useActionState(updateAgencyCommissionRate, null);
  return (
    <form action={formAction}>
      <FieldGroup className="gap-4">
        <input type="hidden" name="agencyId" value={agencyId} />
        <Field>
          <FieldLabel htmlFor="commissionRate">Rate</FieldLabel>
          <InputGroup className="max-sm:h-10">
            <InputGroupInput
              id="commissionRate"
              name="commissionRate"
              type="number"
              step="0.5"
              min="0"
              max="100"
              defaultValue={currentRate}
              required
              className="tabular-nums"
            />
            <Addon>%</Addon>
          </InputGroup>
        </Field>
        <FormFooter state={state}>
          <SubmitButton size="sm" pendingText="Saving…">
            Update rate
          </SubmitButton>
        </FormFooter>
      </FieldGroup>
    </form>
  );
}

export function CreditLimitForm({
  agencyId,
  currentLimit,
}: {
  agencyId: string;
  currentLimit: number;
}) {
  const [state, formAction] = useActionState(updateAgencyCreditLimit, null);
  return (
    <form action={formAction}>
      <FieldGroup className="gap-4">
        <input type="hidden" name="agencyId" value={agencyId} />
        <Field>
          <FieldLabel htmlFor="creditLimit">Limit</FieldLabel>
          <InputGroup className="max-sm:h-10">
            <InputGroupInput
              id="creditLimit"
              name="creditLimit"
              type="number"
              step="50"
              min="0"
              defaultValue={currentLimit}
              required
              className="tabular-nums"
            />
            <Addon>USD</Addon>
          </InputGroup>
        </Field>
        <FormFooter state={state}>
          <SubmitButton size="sm" pendingText="Saving…">
            Update limit
          </SubmitButton>
        </FormFooter>
      </FieldGroup>
    </form>
  );
}

export function WalletTransactionForm({ agencyId }: { agencyId: string }) {
  const [state, formAction] = useActionState(adminApplyWalletTransaction, null);
  return (
    <form action={formAction}>
      <FieldGroup className="gap-4">
        <input type="hidden" name="agencyId" value={agencyId} />
        <Field>
          <FieldLabel htmlFor="amount">Amount</FieldLabel>
          <InputGroup className="max-sm:h-10">
            <InputGroupInput
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              placeholder="500 (negative to correct)"
              required
              className="tabular-nums"
            />
            <Addon>USD</Addon>
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="note">Note</FieldLabel>
          <Textarea id="note" name="note" rows={2} placeholder="Bank transfer ref. 20260806-114 received" />
        </Field>
        <FormFooter state={state}>
          <SubmitButton size="sm" pendingText="Applying…">
            Apply transaction
          </SubmitButton>
        </FormFooter>
      </FieldGroup>
    </form>
  );
}

export function IssueNoteForm({ agencyId }: { agencyId: string }) {
  const [state, formAction] = useActionState(issueAgencyNoteAction, null);
  return (
    <form action={formAction}>
      <FieldGroup className="gap-4">
        <input type="hidden" name="agencyId" value={agencyId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="noteKind">Type</FieldLabel>
            <select id="noteKind" name="kind" defaultValue="credit_note" className={selectClass}>
              <option value="credit_note">Credit note</option>
              <option value="debit_note">Debit note</option>
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="noteAmount">Amount</FieldLabel>
            <InputGroup className="max-sm:h-10">
              <InputGroupInput
                id="noteAmount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="25.00"
                required
                className="tabular-nums"
              />
              <Addon>USD</Addon>
            </InputGroup>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="noteReason">Reason</FieldLabel>
          <Textarea id="noteReason" name="reason" rows={2} placeholder="Goodwill credit for delayed check-in" required />
        </Field>
        <FormFooter state={state}>
          <SubmitButton size="sm" pendingText="Issuing…">
            Issue note
          </SubmitButton>
        </FormFooter>
      </FieldGroup>
    </form>
  );
}

export function CommissionPayoutForm({ agencyId }: { agencyId: string }) {
  const [state, formAction] = useActionState(recordAgencyCommissionPayout, null);
  return (
    <form action={formAction}>
      <FieldGroup className="gap-4">
        <input type="hidden" name="agencyId" value={agencyId} />
        <Field>
          <FieldLabel htmlFor="payoutAmount">Amount</FieldLabel>
          <InputGroup className="max-sm:h-10">
            <InputGroupInput
              id="payoutAmount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="250"
              required
              className="tabular-nums"
            />
            <Addon>USD</Addon>
          </InputGroup>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="payoutMethod">Method</FieldLabel>
            <Input id="payoutMethod" name="method" placeholder="Bank transfer" />
          </Field>
          <Field>
            <FieldLabel htmlFor="payoutReference">Reference</FieldLabel>
            <Input id="payoutReference" name="reference" placeholder="TXN-20260808-1" />
          </Field>
          <Field>
            <FieldLabel htmlFor="periodStart">Period start</FieldLabel>
            <Input id="periodStart" name="periodStart" type="date" />
          </Field>
          <Field>
            <FieldLabel htmlFor="periodEnd">Period end</FieldLabel>
            <Input id="periodEnd" name="periodEnd" type="date" />
          </Field>
        </div>
        <FormFooter state={state}>
          <SubmitButton size="sm" pendingText="Recording…">
            Record payout
          </SubmitButton>
        </FormFooter>
      </FieldGroup>
    </form>
  );
}

const PRODUCT_OPTIONS: Array<{ value: "flight" | "hotel" | "visa" | "umrah" | "hall"; label: string }> = [
  { value: "flight", label: "Flights" },
  { value: "hotel", label: "Hotels" },
  { value: "visa", label: "Visa" },
  { value: "umrah", label: "Umrah" },
  { value: "hall", label: "Events & Halls" },
];

export function AllowedProductsForm({ agencyId, current }: { agencyId: string; current: string[] }) {
  const [state, formAction] = useActionState(updateAgencyAllowedProducts, null);
  const [selected, setSelected] = useState<string[]>(current);

  return (
    <form action={formAction}>
      <FieldGroup className="gap-4">
        <input type="hidden" name="agencyId" value={agencyId} />
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="sr-only">Allowed products</legend>
          {PRODUCT_OPTIONS.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center rounded-full border px-3 text-sm font-medium transition-colors max-sm:h-10",
                  "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                <input
                  type="checkbox"
                  name="products"
                  value={option.value}
                  checked={checked}
                  className="sr-only"
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked ? [...prev, option.value] : prev.filter((v) => v !== option.value)
                    )
                  }
                />
                {option.label}
              </label>
            );
          })}
        </fieldset>
        <FormFooter state={state}>
          <span className="mr-auto text-sm text-muted-foreground">
            {selected.length === 0 ? "Unrestricted" : `${selected.length} of ${PRODUCT_OPTIONS.length}`}
          </span>
          <SubmitButton size="sm" pendingText="Saving…">
            Save
          </SubmitButton>
        </FormFooter>
      </FieldGroup>
    </form>
  );
}
