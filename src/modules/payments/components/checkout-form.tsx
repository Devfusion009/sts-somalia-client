"use client";

import { useActionState, useState } from "react";
import { CreditCard, Smartphone, Wallet, Landmark, Building2, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { initiatePayment, type ActionState } from "@/modules/payments/actions";

/** Serializable subset of PaymentMethodDef safe to pass into a client component. */
export type CheckoutMethod = {
  id: string;
  label: string;
  description: string;
  kind: "card" | "mobile_money" | "wallet" | "bank" | "cash";
  badges: string[];
  requiresPhone: boolean;
  simulated: boolean;
};

const KIND_ICONS = {
  card: CreditCard,
  mobile_money: Smartphone,
  wallet: Wallet,
  bank: Landmark,
  cash: Building2,
} as const;

export function CheckoutForm({
  orderId,
  methods,
  amountLabel,
  currency,
  remaining,
  isFirstPayment,
  minDeposit,
}: {
  orderId: string;
  methods: CheckoutMethod[];
  amountLabel: string;
  currency: string;
  /** Balance still owed — the ceiling for any amount the customer chooses. */
  remaining: number;
  /** True when nothing has been paid on this order yet — the deposit floor only applies here. */
  isFirstPayment: boolean;
  /** Minimum a first payment must cover to count as a deposit (order.total * MIN_DEPOSIT_FRACTION). */
  minDeposit: number;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    initiatePayment,
    null
  );
  const [selectedId, setSelectedId] = useState(methods[0]?.id ?? "");
  const selected = methods.find((m) => m.id === selectedId);

  const canDeposit = isFirstPayment && minDeposit < remaining;
  const [payChoice, setPayChoice] = useState<"full" | "amount">("full");
  const [amount, setAmount] = useState(canDeposit ? minDeposit : remaining);
  const amountFloor = isFirstPayment ? minDeposit : 0.01;
  const payLabel = payChoice === "full" ? amountLabel : `${currency} ${amount.toFixed(2)}`;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="methodId" value={selectedId} />
      <input type="hidden" name="amount" value={payChoice === "full" ? "" : amount} />

      {remaining < 1 - 0.005 ? null : (
        <div>
          <h2 className="text-base font-semibold">How much would you like to pay?</h2>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPayChoice("full")}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition-colors",
                payChoice === "full" ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
              )}
            >
              <span className="block text-sm font-semibold">
                {isFirstPayment ? "Pay in full" : "Pay remaining balance"}
              </span>
              <span className="block text-xs text-muted-foreground">
                {currency} {remaining.toFixed(2)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPayChoice("amount")}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition-colors",
                payChoice === "amount" ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
              )}
            >
              <span className="block text-sm font-semibold">
                {canDeposit ? "Pay a deposit now" : "Pay a different amount"}
              </span>
              <span className="block text-xs text-muted-foreground">
                {canDeposit ? `From ${currency} ${minDeposit.toFixed(2)} — pay the rest later` : "Up to the remaining balance"}
              </span>
            </button>
          </div>
          {payChoice === "amount" ? (
            <div className="mt-3 max-w-xs space-y-1.5">
              <Label htmlFor="amountInput">Amount to pay now ({currency})</Label>
              <Input
                id="amountInput"
                type="number"
                min={amountFloor}
                max={remaining}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                {isFirstPayment
                  ? `Minimum ${currency} ${minDeposit.toFixed(2)} (${Math.round((minDeposit / (remaining || 1)) * 100)}% deposit) — the rest is due before your booking is finalized.`
                  : `Up to the remaining balance of ${currency} ${remaining.toFixed(2)}.`}
              </p>
            </div>
          ) : null}
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold">Select Payment Method</h2>
        <div className="mt-3 space-y-2.5" role="radiogroup" aria-label="Payment method">
          {methods.map((method) => {
            const Icon = KIND_ICONS[method.kind];
            const active = method.id === selectedId;
            return (
              <button
                key={method.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelectedId(method.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left transition-colors",
                  active
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40"
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    active ? "border-primary" : "border-muted-foreground/40"
                  )}
                >
                  {active ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{method.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {method.description}
                    {method.simulated ? " · test mode" : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {method.badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground"
                    >
                      {badge}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selected?.requiresPhone ? (
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="payerPhone">{selected.label} mobile number</Label>
          <Input
            id="payerPhone"
            name="payerPhone"
            type="tel"
            inputMode="tel"
            placeholder="+252 61 XXXXXXX"
            required
          />
          <p className="text-xs text-muted-foreground">
            You&apos;ll receive a prompt on this number to approve the payment.
          </p>
        </div>
      ) : null}

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          By clicking &ldquo;Pay Now&rdquo;, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2">
            Terms &amp; Conditions
          </Link>
          .
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={
            pending ||
            !selected ||
            (payChoice === "amount" && (!Number.isFinite(amount) || amount < amountFloor || amount > remaining))
          }
          className="gap-2"
        >
          <Lock className="size-4" />
          {pending ? "Processing…" : `Pay Now ${payLabel}`}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  );
}
