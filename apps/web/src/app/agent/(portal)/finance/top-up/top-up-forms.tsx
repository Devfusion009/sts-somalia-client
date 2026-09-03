"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/auth/actions";
import { requestOfflineTopup, startOnlineTopup } from "@/modules/agencies/topup-actions";

export type Method = {
  id: string;
  label: string;
  description: string;
  badges: string[];
  requiresPhone: boolean;
  simulated: boolean;
};

function MethodPicker({
  methods,
  value,
  onChange,
  name,
}: {
  methods: Method[];
  value: string;
  onChange: (id: string) => void;
  name: string;
}) {
  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={value} />
      {methods.map((method) => (
        <button
          key={method.id}
          type="button"
          onClick={() => onChange(method.id)}
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
            value === method.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
          )}
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-medium">
              {method.label}
              {method.simulated ? (
                <span className="rounded bg-brand-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-gold">
                  Simulated
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{method.description}</span>
          </span>
          <span className="flex shrink-0 gap-1">
            {method.badges.map((badge) => (
              <span key={badge} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {badge}
              </span>
            ))}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * `defaultAmount` and `onSuccess` exist for the booking desk, which opens
 * this in a dialog with the shortfall already filled in and needs to know
 * when to close and re-read the balance. The Finance page passes neither.
 */
export function OfflineTopupForm({
  methods,
  defaultAmount,
  onSuccess,
}: {
  methods: Method[];
  defaultAmount?: number;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(requestOfflineTopup, null);
  const [method, setMethod] = useState(methods[0]?.id ?? "");
  const submitted = state !== null && !state.error;
  const notified = useRef(false);

  useEffect(() => {
    if (submitted && !notified.current) {
      notified.current = true;
      onSuccess?.();
    }
  }, [submitted, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : submitted ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Sent to STS for confirmation.</AlertDescription>
        </Alert>
      ) : null}

      <MethodPicker methods={methods} value={method} onChange={setMethod} name="method" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="offline-amount">Amount (USD)</Label>
          <Input
            id="offline-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={defaultAmount ? defaultAmount.toFixed(2) : undefined}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="offline-reference">Reference</Label>
          <Input id="offline-reference" name="reference" placeholder="Transfer ref, transaction id, receipt no." />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="offline-proof">Receipt</Label>
        <Input id="offline-proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="offline-note">Note</Label>
        <Textarea id="offline-note" name="note" rows={2} placeholder="Anything STS should know" />
      </div>

      <SubmitButton pendingText="Sending…">Send for confirmation</SubmitButton>
    </form>
  );
}

export function OnlineTopupForm({
  methods,
  defaultAmount,
  returnTo,
}: {
  methods: Method[];
  defaultAmount?: number;
  /** Portal path to land on once the wallet is credited (booking desk). */
  returnTo?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(startOnlineTopup, null);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const selected = methods.find((m) => m.id === methodId);
  const router = useRouter();

  useEffect(() => {
    if (state?.destination) {
      router.push(state.destination);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <MethodPicker methods={methods} value={methodId} onChange={setMethodId} name="method" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="online-amount">Amount (USD)</Label>
          <Input
            id="online-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={defaultAmount ? defaultAmount.toFixed(2) : undefined}
            required
          />
        </div>
        {selected?.requiresPhone ? (
          <div className="grid gap-2">
            <Label htmlFor="online-phone">Mobile number</Label>
            <Input id="online-phone" name="payerPhone" inputMode="tel" placeholder="+252…" required />
          </div>
        ) : null}
      </div>

      <SubmitButton pendingText="Starting…">Pay {selected ? `with ${selected.label}` : "now"}</SubmitButton>
    </form>
  );
}
