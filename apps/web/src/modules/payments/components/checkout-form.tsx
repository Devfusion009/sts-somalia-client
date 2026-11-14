"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CreditCard, Smartphone, Wallet, Landmark, Building2, Lock, ShieldCheck, Check } from "lucide-react";
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
  { id: "local", title: "Mobile money", icon: Smartphone },
  { id: "international", title: "Card", icon: CreditCard },
  { id: "other", title: "Bank & cash", icon: Landmark },
] as const;

const TILE =
  "rounded-xl border bg-card text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

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
  allowPartial,
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
  /** Umrah packages take deposits; every other order is paid in full. */
  allowPartial: boolean;
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
  const onlineAvailable = methods.some(m => ["card", "mobile_money"].includes(m.kind));

  const canDeposit = isFirstPayment && minDeposit < remaining;
  const [payChoice, setPayChoice] = useState<"full" | "amount">("full");
  const [amount, setAmount] = useState(canDeposit ? minDeposit : remaining);
  const amountFloor = isFirstPayment ? minDeposit : 0.01;
  const payLabel = payChoice === "full" ? amountLabel : money(amount, currency);

  // Radio-group keyboard model for the method tiles: one tab stop, arrows move
  // the selection (WAI-ARIA radio pattern). Order matches the rendered groups.
  const groups = GROUPS.filter((g) => methods.some((m) => m.group === g.id));
  const activeGroup = selected?.group ?? groups[0]?.id;
  const orderedMethods = methods.filter((m) => m.group === activeGroup);
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
    <form action={handleSubmit} className="space-y-7">
      {!allowPartial || remaining < 1 - 0.005 || (isFirstPayment && minDeposit >= remaining) ? null : (
        <fieldset>
          <legend id="pay-amount-heading" className="font-heading text-lg font-semibold tracking-tight">
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

      <div className="space-y-4">
        <h2 id="payment-method-heading" className="font-heading text-lg font-semibold tracking-tight">
          Payment method
        </h2>

        {groups.length > 1 ? (
          <div role="tablist" aria-label="Payment type" className="grid gap-1 rounded-xl bg-muted p-1" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
            {groups.map((group) => {
              const active = group.id === activeGroup;
              const GroupIcon = group.icon;
              return (
                <button
                  key={group.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    if (active) return;
                    const first = methods.find((m) => m.group === group.id);
                    if (first) setSelectedId(first.id);
                  }}
                  className={cn(
                    "flex min-h-10 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all sm:flex-row sm:gap-2 sm:text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <GroupIcon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{group.title}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          role="radiogroup"
          aria-labelledby="payment-method-heading"
          onKeyDown={onMethodKeyDown}
          className={cn("grid gap-3", onlineAvailable && orderedMethods.length > 1 && "sm:grid-cols-2")}
        >
          {orderedMethods.map((method) => {
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
                  "relative flex w-full items-start gap-3 p-4",
                  active
                    ? "border-primary bg-primary/[0.04] shadow-[0_0_0_1px_var(--primary)]"
                    : "border-border hover:border-foreground/20 hover:shadow-sm"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                    active ? "border-primary/20 bg-primary text-primary-foreground" : "border-border bg-muted/50 text-muted-foreground"
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1 pr-6">
                  <span className="block text-sm font-semibold">{method.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {method.description}
                    {method.simulated ? " · test mode" : ""}
                  </span>
                  {method.badges.length > 0 ? (
                    <span className="mt-2.5 flex flex-wrap gap-1.5">
                      {method.badges.map((badge) => (
                        <span
                          key={badge}
                          className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
                        >
                          {badge}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-4 right-4 flex size-5 items-center justify-center rounded-full border-2 transition-colors",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                  )}
                >
                  {active ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
              </button>
            );
          })}
          {!onlineAvailable ? (
            <button type="button" role="radio" aria-checked={false} disabled className={cn(TILE, "flex items-start gap-3 border-border bg-muted/30 p-4 text-muted-foreground opacity-75")}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted"><CreditCard className="size-[18px]" aria-hidden /></span>
              <span className="min-w-0"><span className="block text-sm font-semibold">Online payment</span><span className="mt-1 block text-xs">Not yet available</span></span>
            </button>
          ) : null}
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

      <div className="space-y-3 border-t border-border pt-6">
        <Button
          type="submit"
          size="lg"
          loading={initiate.isPending}
          disabled={
            !selected ||
            (payChoice === "amount" && (!Number.isFinite(amount) || amount < amountFloor || amount > remaining))
          }
          className="h-13 w-full gap-2 rounded-xl text-base font-semibold tabular-nums shadow-sm"
        >
          {initiate.isPending ? null : <Lock className="size-4" aria-hidden />}
          {initiate.isPending ? "Processing…" : selected?.id === "cash_office" ? "Choose office payment" : selected?.id === "bank_transfer" ? "Get bank transfer details" : `Pay ${payLabel}`}
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          <span>
            By continuing you agree to our{" "}
            <Link
              href="/terms"
              className="rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              terms and conditions
            </Link>
            .
          </span>
        </p>
      </div>
    </form>
  );
}
