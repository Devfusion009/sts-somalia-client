"use client";

import { useActionState, useState } from "react";
import { CreditCard, Smartphone, Landmark, Building2, Lock, ArrowRight } from "lucide-react";
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
  kind: "card" | "mobile_money" | "bank" | "cash";
  badges: string[];
  requiresPhone: boolean;
  simulated: boolean;
};

const KIND_ICONS = {
  card: CreditCard,
  mobile_money: Smartphone,
  bank: Landmark,
  cash: Building2,
} as const;

export function CheckoutForm({
  orderId,
  methods,
  amountLabel,
}: {
  orderId: string;
  methods: CheckoutMethod[];
  amountLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    initiatePayment,
    null
  );
  const [selectedId, setSelectedId] = useState(methods[0]?.id ?? "");
  const selected = methods.find((m) => m.id === selectedId);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="methodId" value={selectedId} />

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
        <Button type="submit" size="lg" disabled={pending || !selected} className="gap-2">
          <Lock className="size-4" />
          {pending ? "Processing…" : `Pay Now ${amountLabel}`}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </form>
  );
}
