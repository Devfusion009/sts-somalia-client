"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import {
  updateAgencyCommissionRate,
  updateAgencyCreditLimit,
  adminApplyWalletTransaction,
  recordAgencyCommissionPayout,
  updateAgencyAllowedProducts,
  issueAgencyNoteAction,
} from "@/modules/agencies/admin-actions";
import type { ActionState } from "@/lib/auth/actions";

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

export function CommissionRateForm({
  agencyId,
  currentRate,
}: {
  agencyId: string;
  currentRate: number;
}) {
  const [state, formAction] = useActionState(updateAgencyCommissionRate, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="agencyId" value={agencyId} />
      <div className="space-y-1.5">
        <Label htmlFor="commissionRate">Commission rate (%)</Label>
        <Input
          id="commissionRate"
          name="commissionRate"
          type="number"
          step="0.5"
          min="0"
          max="100"
          defaultValue={currentRate}
          required
        />
      </div>
      <FormStatus state={state} />
      <SubmitButton size="sm" pendingText="Saving…">
        Update rate
      </SubmitButton>
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
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="agencyId" value={agencyId} />
      <div className="space-y-1.5">
        <Label htmlFor="creditLimit">Credit limit (USD)</Label>
        <Input
          id="creditLimit"
          name="creditLimit"
          type="number"
          step="50"
          min="0"
          defaultValue={currentLimit}
          required
        />
      </div>
      <FormStatus state={state} />
      <SubmitButton size="sm" pendingText="Saving…">
        Update limit
      </SubmitButton>
    </form>
  );
}

export function WalletTransactionForm({ agencyId }: { agencyId: string }) {
  const [state, formAction] = useActionState(adminApplyWalletTransaction, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="agencyId" value={agencyId} />
      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount (USD)</Label>
        <Input id="amount" name="amount" type="number" step="0.01" placeholder="500 (negative to correct)" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">Note</Label>
        <Textarea
          id="note"
          name="note"
          rows={2}
          placeholder="Bank transfer ref. 20260806-114 received"
        />
      </div>
      <FormStatus state={state} />
      <SubmitButton size="sm" pendingText="Applying…">
        Apply transaction
      </SubmitButton>
    </form>
  );
}

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function IssueNoteForm({ agencyId }: { agencyId: string }) {
  const [state, formAction] = useActionState(issueAgencyNoteAction, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="agencyId" value={agencyId} />
      <div className="space-y-1.5">
        <Label htmlFor="noteKind">Type</Label>
        <select id="noteKind" name="kind" defaultValue="credit_note" className={selectClass}>
          <option value="credit_note">Credit Note — credits the wallet</option>
          <option value="debit_note">Debit Note — charges the wallet</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="noteAmount">Amount (USD)</Label>
        <Input id="noteAmount" name="amount" type="number" step="0.01" min="0.01" placeholder="25.00" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="noteReason">Reason</Label>
        <Textarea id="noteReason" name="reason" rows={2} placeholder="Goodwill credit for delayed check-in" required />
      </div>
      <FormStatus state={state} />
      <SubmitButton size="sm" pendingText="Issuing…">
        Issue note
      </SubmitButton>
    </form>
  );
}

export function CommissionPayoutForm({ agencyId }: { agencyId: string }) {
  const [state, formAction] = useActionState(recordAgencyCommissionPayout, null);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="agencyId" value={agencyId} />
      <div className="space-y-1.5">
        <Label htmlFor="payoutAmount">Amount (USD)</Label>
        <Input id="payoutAmount" name="amount" type="number" step="0.01" min="0.01" placeholder="250" required />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="payoutMethod">Method</Label>
          <Input id="payoutMethod" name="method" placeholder="Bank transfer" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payoutReference">Reference</Label>
          <Input id="payoutReference" name="reference" placeholder="TXN-20260808-1" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="periodStart">Period start (optional)</Label>
          <Input id="periodStart" name="periodStart" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="periodEnd">Period end (optional)</Label>
          <Input id="periodEnd" name="periodEnd" type="date" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Marks confirmed commission entries in this period (or all confirmed entries, if left blank)
        as paid out.
      </p>
      <FormStatus state={state} />
      <SubmitButton size="sm" pendingText="Recording…">
        Record payout
      </SubmitButton>
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
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="agencyId" value={agencyId} />
      <div className="flex flex-wrap gap-1.5">
        {PRODUCT_OPTIONS.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="checkbox"
                name="products"
                value={option.value}
                checked={checked}
                onChange={(e) =>
                  setSelected((prev) => (e.target.checked ? [...prev, option.value] : prev.filter((v) => v !== option.value)))
                }
              />
              {option.label}
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.length === 0
          ? "No products selected — this agency can currently book every vertical (unrestricted)."
          : "This agency can only book the selected verticals. Uncheck all to lift the restriction."}
      </p>
      <FormStatus state={state} />
      <SubmitButton size="sm" pendingText="Saving…">
        Save
      </SubmitButton>
    </form>
  );
}
