"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Landmark } from "lucide-react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/auth/actions";
import { requestAgencyPayout } from "@/modules/agencies/payout-actions";
import { cn } from "@/lib/utils";

const usd = (value: number) => `USD ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const SHARES = [
  { label: "25%", share: 0.25 },
  { label: "50%", share: 0.5 },
  { label: "Max", share: 1 },
];

export function WithdrawForm({ available, bank }: {
  available: number;
  bank: { name: string | null; holder: string | null; accountNumber: string };
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(requestAgencyPayout, null);
  const [amount, setAmount] = useState("");
  const [lastState, setLastState] = useState(state);
  // A sent request clears the amount; revalidation brings the new balance.
  if (state !== lastState) {
    setLastState(state);
    if (state?.error === null) setAmount("");
  }

  const value = Number(amount);
  const entered = amount !== "" && Number.isFinite(value) && value > 0;
  const tooMuch = entered && value > available + 1e-9;
  const remaining = Math.max(available - (entered ? value : 0), 0);
  const empty = available <= 0;

  return (
    <form action={formAction} className="space-y-5">
      <Field data-invalid={state?.error || tooMuch ? true : undefined}>
        <FieldLabel htmlFor="amount">Amount</FieldLabel>
        <InputGroup className="h-14">
          <InputGroupAddon>
            <InputGroupText className="text-base font-semibold">USD</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            id="amount"
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max={available}
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={empty}
            aria-invalid={state?.error || tooMuch ? true : undefined}
            required
            className="font-heading text-2xl font-semibold tabular-nums"
          />
        </InputGroup>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Quick amounts">
          {SHARES.map(({ label, share }) => {
            const preset = (Math.floor(available * share * 100) / 100).toFixed(2);
            const active = entered && amount === preset;
            return (
              <button
                key={label}
                type="button"
                disabled={empty}
                aria-pressed={active}
                onClick={() => setAmount(preset)}
                className={cn(
                  "min-h-9 rounded-lg border text-xs font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50 hover:bg-accent"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <FieldError>{tooMuch ? `Maximum ${usd(available)}.` : state?.error}</FieldError>
      </Field>

      <div className="rounded-xl border border-border bg-secondary/50 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary ring-1 ring-border" aria-hidden="true">
            <Landmark className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{bank.name ?? "Bank account"}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {bank.holder ? `${bank.holder} · ` : ""}•••• {bank.accountNumber.slice(-4)}
            </p>
          </div>
          <Link href="/agent/bank-details" className="rounded-md px-2 py-1 text-xs font-semibold text-primary outline-none hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50">
            Change
          </Link>
        </div>
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">You receive</dt>
            <dd className="font-semibold tabular-nums">{usd(entered && !tooMuch ? value : 0)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Balance after</dt>
            <dd className="tabular-nums">{usd(tooMuch ? available : remaining)}</dd>
          </div>
        </dl>
      </div>

      <SubmitButton size="lg" disabled={empty || !entered || tooMuch} pendingText="Requesting…" className="w-full">
        {entered && !tooMuch ? `Withdraw ${usd(value)}` : "Withdraw"}
        <ArrowRight className="size-4" aria-hidden="true" />
      </SubmitButton>
      {state?.error === null ? <p role="status" className="text-center text-sm font-medium text-primary">Request sent.</p> : null}
    </form>
  );
}
