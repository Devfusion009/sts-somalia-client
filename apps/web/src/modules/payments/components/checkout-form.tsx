"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CreditCard, Smartphone, Wallet, Landmark, Building2, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { money } from "@/lib/money";
import { trpc } from "@/lib/trpc/react";

/** Serializable subset of PaymentMethodDef safe to pass into a client component. */
export type CheckoutMethod = {
  id: string;
  label: string;
  description: string;
  kind: "card" | "mobile_money" | "wallet" | "bank" | "cash";
  group: "local" | "international" | "other";
  badges: string[];
  requiresPhone: boolean;
  simulated: boolean;
};

const GROUPS = [
  { id: "local", title: "Local payments" },
  { id: "international", title: "International cards" },
  { id: "other", title: "Other ways to pay" },
] as const;

const TILE =
  "rounded-xl border bg-card text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

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
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const initiate = trpc.payments.initiate.useMutation({
    onSuccess: (data) => {
      if (data.error) {
        setError(data.error);
        return;
      }
      if (data.result?.type === "redirect") {
        window.location.href = data.result.url;
        return;
      }
      // "success" and "instructions" both land back on the checkout page: a
      // fully-settled order redirects itself to /success on reload, a still-
      // open balance or a requires_action banner just re-renders here.
      router.push(`/checkout/${data.orderId ?? orderId}`);
      router.refresh();
    },
    onError: (err) => setError(err.message),
  });
  const [selectedId, setSelectedId] = useState(methods[0]?.id ?? "");
  const selected = methods.find((m) => m.id === selectedId);

  const canDeposit = isFirstPayment && minDeposit < remaining;
  const [payChoice, setPayChoice] = useState<"full" | "amount">("full");
  const [amount, setAmount] = useState(canDeposit ? minDeposit : remaining);
  const amountFloor = isFirstPayment ? minDeposit : 0.01;
  const payLabel = payChoice === "full" ? amountLabel : money(amount, currency);

  // Radio-group keyboard model for the method tiles: one tab stop, arrows move
  // the selection (WAI-ARIA radio pattern). Order matches the rendered groups.
  const orderedMethods = GROUPS.flatMap((g) => methods.filter((m) => m.group === g.id));
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
  function onMethodKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key) || orderedMethods.length === 0) return;
    e.preventDefault();
    const index = Math.max(0, orderedMethods.findIndex((m) => m.id === selectedId));
    const last = orderedMethods.length - 1;
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? last
          : e.key === "ArrowDown" || e.key === "ArrowRight"
            ? (index + 1) % orderedMethods.length
            : (index - 1 + orderedMethods.length) % orderedMethods.length;
    const id = orderedMethods[next].id;
    setSelectedId(id);
    tileRefs.current.get(id)?.focus();
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    initiate.mutate({
      orderId,
      methodId: selectedId,
      payerPhone: (formData.get("payerPhone")?.toString().trim() || undefined) as string | undefined,
      amount: payChoice === "full" ? undefined : amount,
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {remaining < 1 - 0.005 ? null : (
        <fieldset>
          <legend id="pay-amount-heading" className="font-heading text-base font-semibold">
            Amount
          </legend>
          <div role="radiogroup" aria-labelledby="pay-amount-heading" className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              role="radio"
              aria-checked={payChoice === "full"}
              onClick={() => setPayChoice("full")}
              className={cn(
                TILE,
                "px-4 py-3",
                payChoice === "full" ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
              )}
            >
              <span className="block text-sm font-semibold">
                {isFirstPayment ? "Pay in full" : "Pay remaining balance"}
              </span>
              <span className="block text-sm text-muted-foreground tabular-nums">
                {money(remaining, currency)}
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={payChoice === "amount"}
              onClick={() => setPayChoice("amount")}
              className={cn(
                TILE,
                "px-4 py-3",
                payChoice === "amount" ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
              )}
            >
              <span className="block text-sm font-semibold">
                {canDeposit ? "Pay a deposit" : "Pay a different amount"}
              </span>
              <span className="block text-sm text-muted-foreground tabular-nums">
                {canDeposit ? `From ${money(minDeposit, currency)}` : `Up to ${money(remaining, currency)}`}
              </span>
            </button>
          </div>
          {payChoice === "amount" ? (
            <div className="mt-4 max-w-xs space-y-1.5">
              <Label htmlFor="amountInput">Amount to pay now ({currency})</Label>
              <Input
                id="amountInput"
                type="number"
                inputMode="decimal"
                min={amountFloor}
                max={remaining}
                step="0.01"
                value={amount}
                aria-invalid={!Number.isFinite(amount) || amount < amountFloor || amount > remaining || undefined}
                aria-describedby="amountLimits"
                className="tabular-nums"
                onChange={(e) => setAmount(Number(e.target.value))}
              />
              <p id="amountLimits" className="text-xs text-muted-foreground tabular-nums">
                {isFirstPayment
                  ? `Minimum ${money(minDeposit, currency)} · maximum ${money(remaining, currency)}`
                  : `Maximum ${money(remaining, currency)}`}
              </p>
            </div>
          ) : null}
        </fieldset>
      )}

      <div>
        <h2 id="payment-method-heading" className="font-heading text-base font-semibold">
          Payment method
        </h2>
        <div
          className="mt-3 space-y-5"
          role="radiogroup"
          aria-labelledby="payment-method-heading"
          onKeyDown={onMethodKeyDown}
        >
          {GROUPS.map((group) => {
            const groupMethods = methods.filter((m) => m.group === group.id);
            if (groupMethods.length === 0) return null;
            return (
              <div key={group.id} className="space-y-2.5">
                <h3 className="text-sm font-medium text-muted-foreground">{group.title}</h3>
                {groupMethods.map((method) => {
            const Icon = KIND_ICONS[method.kind];
            const active = method.id === selectedId;
            return (
              <button
                key={method.id}
                ref={(el) => {
                  if (el) tileRefs.current.set(method.id, el);
                  else tileRefs.current.delete(method.id);
                }}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active || (!selected && method.id === orderedMethods[0]?.id) ? 0 : -1}
                onClick={() => setSelectedId(method.id)}
                className={cn(
                  TILE,
                  "flex min-h-14 w-full items-center gap-3 px-4 py-3",
                  active
                    ? "border-primary bg-primary/[0.03] ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    active ? "border-primary" : "border-muted-foreground/40"
                  )}
                >
                  {active ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{method.label}</span>
                  <span className="block text-xs text-muted-foreground sm:truncate">
                    {method.description}
                    {method.simulated ? " · test mode" : ""}
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  {method.badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground"
                    >
                      {badge}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
              </div>
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
            autoComplete="tel"
            required
          />
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          By paying you agree to our{" "}
          <Link
            href="/terms"
            className="rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            terms and conditions
          </Link>
          .
        </p>
        <Button
          type="submit"
          size="lg"
          loading={initiate.isPending}
          disabled={
            !selected ||
            (payChoice === "amount" && (!Number.isFinite(amount) || amount < amountFloor || amount > remaining))
          }
          className="w-full gap-2 tabular-nums sm:w-auto"
        >
          {initiate.isPending ? null : <Lock className="size-4" aria-hidden />}
          {initiate.isPending ? "Processing…" : `Pay ${payLabel}`}
        </Button>
      </div>
    </form>
  );
}
